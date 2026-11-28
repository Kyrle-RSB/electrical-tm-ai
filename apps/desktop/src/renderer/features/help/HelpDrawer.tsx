import {useEffect,useRef} from 'react';
import {Button,Kbd} from '../../components/ui';
/** Nonmodal help panel: no focus trap or background interaction restriction. */
export function HelpDrawer({open,onClose,onOpenComponents}:{open:boolean;onClose:()=>void;onOpenComponents:()=>void}){
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  closeRef.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[open,onClose]);
 if(!open)return null;
 return <aside id="help-region" className="tm-card help-panel" role="region" aria-labelledby="help-heading">
  <div className="section-header"><h2 id="help-heading">Getting started</h2><Button ref={closeRef} variant="ghost" size="sm" onClick={onClose}>Close help</Button></div>
  <p>This is an engineering proof. Do not enter real customer records or API credentials.</p>
  <ol>
   <li>In <strong>Business profile</strong>, enter synthetic company details and save.</li>
   <li>Create a fictional project, then confirm it reloads after a restart.</li>
   <li>Import a synthetic PNG/JPEG receipt. The app stores it locally; no AI call occurs.</li>
   <li>Set a separate backup folder and create a backup. Do not delete the original database.</li>
   <li>Use the restore button only with your test profile after verifying the backup.</li>
  </ol>
  <p>Public setup and troubleshooting guides live in the source repository under <code>docs/user/</code>. Press <Kbd keys={['Escape']}/> to close this panel.</p>
  <div className="help-panel__design">
   <div><h3>Design system</h3><p className="muted">Every colour, type size and component in this app, in light and dark.</p></div>
   <Button onClick={onOpenComponents}>Open components page</Button>
  </div>
 </aside>;
}
