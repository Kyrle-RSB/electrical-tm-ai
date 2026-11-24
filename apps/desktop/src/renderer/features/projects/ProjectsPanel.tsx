import {useRef,useState} from 'react';
import type {DetailedProject} from '../../../../../../packages/contracts/src/ipc/projects.contract';
export type ProjectRow=DetailedProject;
export function ProjectsPanel({projects,onChanged}:{projects:ProjectRow[];onChanged:()=>Promise<void>}){
 const [error,setError]=useState('');const [busy,setBusy]=useState<string|null>(null);
 const lock=useRef(false);
 const [editing,setEditing]=useState<string|null>(null);
 const [draft,setDraft]=useState({code:'',customer:'',siteAddress:'',details:{name:'',billingAddress:'',notes:''}});
 const startEdit=(p:ProjectRow)=>{setEditing(p.id);setDraft({code:p.project_code,customer:p.customer_name,siteAddress:p.site_address,details:{name:p.project_name,billingAddress:p.billing_address,notes:p.notes}});setError('');};
 async function toggle(project:ProjectRow){
  if(lock.current)return;lock.current=true;setBusy(project.id);setError('');try{
    await window.tmBridge.setProjectStatus({id:project.id,status:project.status==='archived'?'active':'archived'});
    await onChanged();
  }catch(err){setError(String(err));}finally{lock.current=false;setBusy(null);}
 }
 async function save(id:string){
  if(lock.current)return;lock.current=true;setBusy(id);setError('');try{
   await window.tmBridge.updateProject({id,...draft});setEditing(null);await onChanged();
  }catch(err){setError('Unable to save project: '+String(err));}
  finally{lock.current=false;setBusy(null);}
 }
 return <><ul className="project-list">{projects.map(project=><li key={project.id}>
    <div className="project-row"><div><strong>{project.project_code}</strong>
      <span className="project-status-label">{project.status}</span><div>{project.customer_name} · Site: {project.site_address}</div>
      {project.project_name&&<div>{project.project_name}</div>}
      {project.billing_address&&<div>Billing: {project.billing_address}</div>}
      {project.notes&&<div>Notes: {project.notes}</div>}
    </div><div className="actions"><button type="button" disabled={busy!==null} onClick={()=>startEdit(project)}>Edit</button>
    <button type="button" disabled={busy!==null} onClick={()=>toggle(project)}>
      {project.status==='archived'?'Reopen':'Archive'}</button></div></div>
    {editing===project.id&&<form aria-label={'Edit project '+project.project_code} onSubmit={e=>{e.preventDefault();save(project.id);}}>
      <label>Code<input required maxLength={60} value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value})}/></label>
      <label>Customer<input required maxLength={200} value={draft.customer} onChange={e=>setDraft({...draft,customer:e.target.value})}/></label>
      <label>Site address<input required maxLength={300} value={draft.siteAddress} onChange={e=>setDraft({...draft,siteAddress:e.target.value})}/></label>
      <label>Project name<input maxLength={200} value={draft.details.name} onChange={e=>setDraft({...draft,details:{...draft.details,name:e.target.value}})}/></label>
      <label>Billing address<input maxLength={600} value={draft.details.billingAddress} onChange={e=>setDraft({...draft,details:{...draft.details,billingAddress:e.target.value}})}/></label>
      <label>Project notes<textarea maxLength={2000} value={draft.details.notes} onChange={e=>setDraft({...draft,details:{...draft.details,notes:e.target.value}})}/></label>
      <button disabled={busy!==null} type="submit">Save changes</button>
      <button type="button" disabled={busy!==null} onClick={()=>setEditing(null)}>Cancel</button>
    </form>}
    </li>)}</ul>{error&&<p role="alert">{error}</p>}</>;
}
