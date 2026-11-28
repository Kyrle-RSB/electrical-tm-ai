/** A small in-house router (ADR-0013). The current screen is typed state, not a URL:
 * the packaged page stays on tmapp://app/index.html, so the navigation guard and the
 * security smoke see no navigation at all. The last screen is kept per session. */
import {DEFAULT_ROUTE,isRouteId,type RouteId} from './routes';

type KeyStorage={getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
export const ROUTE_STORAGE_KEY='tm.shell.route';
export const SIDEBAR_STORAGE_KEY='tm.shell.sidebar';

/** Where focus goes after a navigation: stay put (sidebar clicks), the new screen's
 * heading (palette, skip button), or one element by id (palette actions). */
export type FocusRequest='none'|'heading'|{elementId:string};
export type RouterState={route:RouteId;previous:RouteId|null;focus:FocusRequest;
 /** Increases on every navigation, so the shell can react to a repeat request. */
 sequence:number};
export type Router={
 get():RouterState;
 navigate(route:RouteId,options?:{focus?:FocusRequest}):void;
 subscribe(listener:()=>void):()=>void;
};

function sessionStore():KeyStorage|null{
 try{return typeof window!=='undefined'?window.sessionStorage:null;}catch{return null;}
}
function localStore():KeyStorage|null{
 try{return typeof window!=='undefined'?window.localStorage:null;}catch{return null;}
}

/** Anything unknown, missing or unreadable opens Today. */
export function readLastRoute(storage:KeyStorage|null=sessionStore()):RouteId{
 try{const saved=storage?.getItem(ROUTE_STORAGE_KEY);return isRouteId(saved)?saved:DEFAULT_ROUTE;}catch{return DEFAULT_ROUTE;}
}
export function writeLastRoute(route:RouteId,storage:KeyStorage|null=sessionStore()):void{
 try{storage?.setItem(ROUTE_STORAGE_KEY,route);}catch{/* A blocked store only loses the memory, never the navigation. */}
}

export function createRouter(initial:RouteId=readLastRoute(),storage:KeyStorage|null=sessionStore()):Router{
 let state:RouterState={route:initial,previous:null,focus:'none',sequence:0};
 const listeners=new Set<()=>void>();
 return {
  get:()=>state,
  navigate(route,options={}){
   if(!isRouteId(route))throw new Error('Unknown route');
   const focus=options.focus??'none';
   state={route,previous:route===state.route?state.previous:state.route,focus,sequence:state.sequence+1};
   writeLastRoute(route,storage);
   for(const listener of [...listeners])listener();
  },
  subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};}
 };
}

/** The sidebar collapses to icons below this window width (CSS pixels). */
export const SIDEBAR_COLLAPSE_BELOW=1200;
export type SidebarChoice='expanded'|'collapsed';
/** On a wide window the person's saved choice wins (expanded by default). On a narrow
 * window it starts collapsed; expanding it there lasts until the window is wide again. */
export function isSidebarCollapsed({narrow,wideChoice,expandedWhileNarrow}:{narrow:boolean;wideChoice:SidebarChoice;expandedWhileNarrow:boolean}):boolean{
 return narrow?!expandedWhileNarrow:wideChoice==='collapsed';
}
export function readSidebarChoice(storage:KeyStorage|null=localStore()):SidebarChoice{
 try{return storage?.getItem(SIDEBAR_STORAGE_KEY)==='collapsed'?'collapsed':'expanded';}catch{return 'expanded';}
}
export function writeSidebarChoice(choice:SidebarChoice,storage:KeyStorage|null=localStore()):void{
 try{if(choice==='expanded')storage?.removeItem(SIDEBAR_STORAGE_KEY);else storage?.setItem(SIDEBAR_STORAGE_KEY,choice);}catch{/* display preference only */}
}
