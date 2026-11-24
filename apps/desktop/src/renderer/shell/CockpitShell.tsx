import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {getSystemAppearance,subscribeToSystemAppearance} from '../theme/system-theme';
import {HelpDrawer} from '../features/help/HelpDrawer';
export function CockpitShell({children}:{children:ReactNode}){
 const [showHelp,setShowHelp]=useState(false);
 const helpTrigger=useRef<HTMLButtonElement>(null);
 const closeHelp=useCallback(()=>{setShowHelp(false);helpTrigger.current?.focus();},[]);
 const [appearance,setAppearance]=useState<'light'|'dark'>(getSystemAppearance);
 useEffect(()=>subscribeToSystemAppearance(setAppearance),[]);
 return <main className="wrap">
  <header className="hero">
   <div><strong>Electrical T&M</strong><p>Local-first · Fork B Phase 2 foundation</p></div>
   <div className="actions header-actions"><span className="tag">SYNTHETIC ONLY</span>
     <span className="theme-indicator">System {appearance}</span>
     <button ref={helpTrigger} type="button" aria-expanded={showHelp} aria-controls="help-region" onClick={()=>setShowHelp(v=>!v)}>Help</button>
   </div>
  </header>
  <HelpDrawer open={showHelp} onClose={closeHelp}/>
  {children}
  <footer>Local storage · No staff accounts · No cloud synchronization · Current build is not cleared for real billing</footer>
 </main>;
}
