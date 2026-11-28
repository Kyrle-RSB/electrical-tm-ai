import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Badge,Button,Icon,Kbd} from '../components/ui';
import {currentPlatform} from '../components/ui/format';
import {HelpDrawer} from '../features/help/HelpDrawer';
import {useAppearance} from '../theme/AppearanceProvider';
import {CommandPalette} from './CommandPalette';
import {buildCommands,isPaletteShortcut,type Command,type PaletteProject} from './commands';
import {ROUTES,routeDefinition,type RouteDefinition} from './routes';
import {SIDEBAR_COLLAPSE_BELOW,isSidebarCollapsed,readSidebarChoice,writeSidebarChoice,type Router,type RouterState,type SidebarChoice} from './router';

export function useRouterState(router:Router):RouterState{
 return useSyncExternalStore(router.subscribe,router.get);
}

const OpenPaletteContext=createContext<(()=>void)|null>(null);
/** Lets a screen offer an "Open command palette" button. */
export function useOpenPalette():()=>void{
 const open=useContext(OpenPaletteContext);
 if(!open)throw new Error('useOpenPalette needs AppShell');
 return open;
}

const NARROW_QUERY=`(max-width: ${SIDEBAR_COLLAPSE_BELOW-0.02}px)`;
function useNarrowWindow():boolean{
 const [narrow,setNarrow]=useState(()=>window.matchMedia?.(NARROW_QUERY).matches??false);
 useEffect(()=>{
  const query=window.matchMedia?.(NARROW_QUERY);if(!query)return;
  const changed=()=>setNarrow(query.matches);changed();
  query.addEventListener('change',changed);
  return()=>query.removeEventListener('change',changed);
 },[]);
 return narrow;
}

/** The product shell: sidebar, header with search, the command palette and the main
 * area where the current screen renders. Screens come in as children. */
export function AppShell({router,state,projects,onCheckHealth,children}:{router:Router;state:RouterState;projects:readonly PaletteProject[];onCheckHealth:()=>void;children:ReactNode}){
 const {appearance,preference,setPreference}=useAppearance();
 const platform=useMemo(()=>currentPlatform(),[]);

 // Sidebar: saved choice on a wide window, icons below about 1200 px.
 const narrow=useNarrowWindow();
 const [wideChoice,setWideChoice]=useState<SidebarChoice>(()=>readSidebarChoice());
 const [expandedWhileNarrow,setExpandedWhileNarrow]=useState(false);
 useEffect(()=>{if(!narrow)setExpandedWhileNarrow(false);},[narrow]);
 const collapsed=isSidebarCollapsed({narrow,wideChoice,expandedWhileNarrow});
 const toggleSidebar=useCallback(()=>{
  if(narrow){setExpandedWhileNarrow(v=>!v);return;}
  const next:SidebarChoice=wideChoice==='collapsed'?'expanded':'collapsed';
  writeSidebarChoice(next);setWideChoice(next);
 },[narrow,wideChoice]);

 // Help drawer (nonmodal); focus goes back to the Help button when it closes.
 const [showHelp,setShowHelp]=useState(false);
 const helpTrigger=useRef<HTMLButtonElement>(null);
 const closeHelp=useCallback(()=>{setShowHelp(false);helpTrigger.current?.focus();},[]);

 // Command palette. A chosen command runs after the dialog has closed and handed
 // focus back, so a navigation can then move focus to the new screen.
 const [palette,setPalette]=useState({open:false,query:''});
 const pending=useRef<Command|null>(null);
 const returnFocus=useRef<HTMLElement|null>(null);
 const openPalette=useCallback((query='')=>{
  returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setPalette({open:true,query});
 },[]);
 const openPaletteEmpty=useCallback(()=>openPalette(''),[openPalette]);
 const commands=useMemo(()=>buildCommands({projects,sidebarCollapsed:collapsed}),[projects,collapsed]);
 const carryOut=useCallback((command:Command)=>{
  const intent=command.intent;
  if(intent.kind==='navigate'){router.navigate(intent.route,{focus:'heading'});return;}
  if(intent.kind==='project'){router.navigate('jobs',{focus:{elementId:'project-row-'+intent.projectId}});return;}
  switch(intent.action){
   case 'new-project':router.navigate('jobs',{focus:{elementId:'new-project-code'}});break;
   case 'check-health':onCheckHealth();break;
   case 'theme-light':setPreference('light');break;
   case 'theme-dark':setPreference('dark');break;
   case 'theme-system':setPreference('system');break;
   case 'toggle-sidebar':toggleSidebar();break;
   case 'open-help':setShowHelp(true);break;
  }
 },[router,onCheckHealth,setPreference,toggleSidebar]);
 const runCommand=useCallback((command:Command)=>{pending.current=command;setPalette(p=>({...p,open:false}));},[]);
 const closePalette=useCallback(()=>{
  setPalette(p=>({...p,open:false}));
  // The Close button calls this while the dialog is still open; its close event follows.
  if(document.querySelector('dialog.palette-dialog[open]'))return;
  const command=pending.current;pending.current=null;
  // The native dialog normally restores focus itself; make sure, then run the command,
  // which may move focus on (to a new screen's heading or a field).
  const back=returnFocus.current;returnFocus.current=null;
  if(back?.isConnected&&document.activeElement!==back)back.focus();
  if(command)carryOut(command);
 },[carryOut]);

 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{
   if(!isPaletteShortcut(event,platform))return;
   event.preventDefault();
   if(palette.open){setPalette(p=>({...p,open:false}));return;}
   if(document.querySelector('dialog[open]'))return; // another dialog owns the keyboard
   openPalette('');
  };
  window.addEventListener('keydown',keydown);
  return()=>window.removeEventListener('keydown',keydown);
 },[platform,palette.open,openPalette]);

 // Each navigation: new window title, scroll to top, then the requested focus.
 const mainRef=useRef<HTMLElement>(null);
 const current=routeDefinition(state.route);
 useEffect(()=>{document.title=`${current.label} · Electrical T&M`;},[current]);
 useEffect(()=>{mainRef.current?.scrollTo?.({top:0});},[state.route]);
 useEffect(()=>{
  const focus=state.focus,main=mainRef.current;
  if(focus==='none'||!main)return;
  const target=typeof focus==='object'?document.getElementById(focus.elementId):null;
  const heading=main.querySelector<HTMLElement>('[data-screen]:not([hidden]) h1');
  if(target){target.focus();target.scrollIntoView?.({block:'center'});}else heading?.focus();
 },[state.sequence,state.focus]);

 const item=(route:RouteDefinition)=><li key={route.id}>
  <button type="button" className="app-nav__item" aria-current={state.route===route.id?'page':undefined} onClick={()=>router.navigate(route.id)}>
   <Icon name={route.icon} size={18}/><span className="app-nav__label">{route.label}</span>
  </button>
 </li>;

 return <div className={`app${collapsed?' app--collapsed':''}`}>
  <button type="button" className="app-skip" onClick={()=>router.navigate(state.route,{focus:'heading'})}>Skip to content</button>
  <div id="app-sidebar" className={`app-sidebar${collapsed?' is-collapsed':''}`}>
   <div className="app-brand">
    <span className="app-brand__mark"><Icon name="bolt" size={18}/></span>
    <span className="app-brand__text"><strong className="app-brand__name">Electrical T&amp;M</strong><span className="app-brand__meta">Local-first · Phase 2</span></span>
   </div>
   <nav className="app-nav" aria-label="Main">
    <ul className="app-nav__list">{ROUTES.filter(r=>r.placement==='main').map(item)}</ul>
    <ul className="app-nav__list app-nav__list--end">{ROUTES.filter(r=>r.placement==='end').map(item)}</ul>
   </nav>
  </div>
  <div className="app-column">
   <header className="app-header">
    <Button variant="ghost" icon="panelLeft" iconOnly aria-expanded={!collapsed} aria-controls="app-sidebar" onClick={toggleSidebar}>{collapsed?'Expand sidebar':'Collapse sidebar'}</Button>
    <label className="app-search">
     <Icon name="search" className="app-search__icon"/>
     <span className="tm-visually-hidden">Search screens, actions and projects</span>
     <input className="tm-input app-search__input" type="search" placeholder="Search or jump to" autoComplete="off" spellCheck={false} value=""
      onChange={event=>openPalette(event.target.value)} onClick={()=>openPalette('')}
      onKeyDown={event=>{if(event.key==='Enter'||event.key==='ArrowDown'){event.preventDefault();openPalette('');}}}/>
     <span className="app-search__kbd"><Kbd keys={['Mod','K']} platform={platform}/></span>
    </label>
    <div className="app-header__end">
     <Badge tone="accent" dot>Fictional data only</Badge>
     <span className="theme-indicator">Theme: {appearance}{preference==='system'?', follows system':', set in Settings'}</span>
     <Button ref={helpTrigger} variant="ghost" icon="help" aria-expanded={showHelp} aria-controls="help-region" onClick={()=>setShowHelp(v=>!v)}>Help</Button>
    </div>
   </header>
   <main className="app-main" id="main-content" ref={mainRef}>
    <div className="app-content">
     <HelpDrawer open={showHelp} onClose={closeHelp} onOpenComponents={()=>{setShowHelp(false);router.navigate('components',{focus:'heading'});}} onOpenPalette={()=>{setShowHelp(false);openPalette('');}}/>
     <OpenPaletteContext.Provider value={openPaletteEmpty}>{children}</OpenPaletteContext.Provider>
     <footer className="app-footer">Local storage · No staff accounts · No cloud synchronization · Current build is not cleared for real billing</footer>
    </div>
   </main>
  </div>
  <CommandPalette open={palette.open} initialQuery={palette.query} commands={commands} onRun={runCommand} onClose={closePalette}/>
 </div>;
}
