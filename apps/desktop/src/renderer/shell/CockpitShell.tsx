import {useCallback,useRef,useState,type ReactNode} from 'react';
import {useAppearance} from '../theme/AppearanceProvider';
import {HelpDrawer} from '../features/help/HelpDrawer';
import {Badge,Button,Icon} from '../components/ui';
export function CockpitShell({children,onOpenComponents}:{children:ReactNode;onOpenComponents:()=>void}){
 const [showHelp,setShowHelp]=useState(false);
 const helpTrigger=useRef<HTMLButtonElement>(null);
 const closeHelp=useCallback(()=>{setShowHelp(false);helpTrigger.current?.focus();},[]);
 const {appearance,preference}=useAppearance();
 const openComponents=useCallback(()=>{setShowHelp(false);onOpenComponents();},[onOpenComponents]);
 return <main className="wrap">
  <header className="hero">
   <div className="brand"><span className="brand__mark"><Icon name="bolt" size={18}/></span>
    <div className="brand__text"><strong className="brand__name">Electrical T&amp;M</strong><p className="brand__meta">Local-first · Phase 2 foundation</p></div></div>
   <div className="actions header-actions"><Badge tone="accent" dot>Fictional data only</Badge>
     <span className="theme-indicator">Theme: {appearance}{preference==='system'?', follows system':', set in Settings'}</span>
     <Button ref={helpTrigger} variant="ghost" icon="help" aria-expanded={showHelp} aria-controls="help-region" onClick={()=>setShowHelp(v=>!v)}>Help</Button>
   </div>
  </header>
  <HelpDrawer open={showHelp} onClose={closeHelp} onOpenComponents={openComponents}/>
  {children}
  <footer className="app-footer">Local storage · No staff accounts · No cloud synchronization · Current build is not cleared for real billing</footer>
 </main>;
}
