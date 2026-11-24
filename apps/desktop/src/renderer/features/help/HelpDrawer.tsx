import {useEffect,useRef} from 'react';
/** Nonmodal help panel: no focus trap or background interaction restriction. */
export function HelpDrawer({open,onClose}:{open:boolean;onClose:()=>void}){
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  closeRef.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[open,onClose]);
 if(!open)return null;
 return <aside id="help-region" className="glass help-panel" role="region" aria-labelledby="help-heading">
  <div className="section-header"><h2 id="help-heading">Getting started</h2><button ref={closeRef} onClick={onClose}>Close help</button></div>
  <p>This is an engineering proof. Do not enter real customer records or API credentials.</p>
  <ol>
   <li>In <strong>Business profile</strong>, enter synthetic company details and save.</li>
   <li>Create a fictional project, then confirm it reloads after a restart.</li>
   <li>Import a synthetic PNG/JPEG receipt. The app stores it locally; no AI call occurs.</li>
   <li>Set a separate backup folder and create a backup. Do not delete the original database.</li>
   <li>Use the restore button only with your test profile after verifying the backup.</li>
  </ol>
  <p>Public setup and troubleshooting guides live in the source repository under <code>docs/user/</code>.</p>
 </aside>;
}
