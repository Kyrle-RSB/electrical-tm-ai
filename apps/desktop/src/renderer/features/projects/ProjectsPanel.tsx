import {useRef,useState} from 'react';
import {Badge,Button,EmptyState,TextArea,TextField} from '../../components/ui';
import type {DetailedProject} from '../../../../../../packages/contracts/src/ipc/projects.contract';
export type ProjectRow=DetailedProject;
export function ProjectsPanel({projects,ready=true,onChanged,track}:{projects:ProjectRow[];ready?:boolean;onChanged:()=>Promise<void>;track:<T>(action:()=>Promise<T>)=>Promise<T>}){
 const [error,setError]=useState('');const [busy,setBusy]=useState<string|null>(null);
 const lock=useRef(false);
 const [editing,setEditing]=useState<string|null>(null);
 const [statusEditing,setStatusEditing]=useState<string|null>(null);
 const [statusReason,setStatusReason]=useState('');
 const [draft,setDraft]=useState({code:'',customer:'',siteAddress:'',details:{name:'',billingAddress:'',notes:''}});
 const startEdit=(p:ProjectRow)=>{setStatusEditing(null);setEditing(p.id);setDraft({code:p.project_code,customer:p.customer_name,siteAddress:p.site_address,details:{name:p.project_name,billingAddress:p.billing_address,notes:p.notes}});setError('');};
 async function toggle(project:ProjectRow){
  if(lock.current)return;lock.current=true;setBusy(project.id);setError('');try{
    await track(async()=>{await window.tmBridge.setProjectStatus({id:project.id,status:project.status==='archived'?'active':'archived',reason:statusReason});
    setStatusEditing(null);setStatusReason('');await onChanged();});
  }catch(err){setError(String(err));}finally{lock.current=false;setBusy(null);}
 }
 async function save(id:string){
  if(lock.current)return;lock.current=true;setBusy(id);setError('');try{
   await track(async()=>{await window.tmBridge.updateProject({id,...draft});setEditing(null);await onChanged();});
  }catch(err){setError('Unable to save project: '+String(err));}
  finally{lock.current=false;setBusy(null);}
 }
 return <>{ready&&projects.length===0&&<EmptyState compact icon="inbox" title="No projects yet">Create a fictional project above. It is saved in the local database and reloads after a restart.</EmptyState>}
  <ul className="project-list">{projects.map(project=><li key={project.id} id={'project-row-'+project.id} tabIndex={-1}>
    <div className="project-row"><div className="project-row__main">
      <div className="project-row__title"><strong className="project-row__code">{project.project_code}</strong>
      <Badge tone={project.status==='archived'?'slate':'success'} dot>{project.status==='archived'?'Archived':'Active'}</Badge></div>
      <div className="project-row__meta">{project.customer_name} · Site: {project.site_address}</div>
      {project.project_name&&<div className="project-row__detail">{project.project_name}</div>}
      {project.billing_address&&<div className="project-row__detail">Billing: {project.billing_address}</div>}
      {project.notes&&<div className="project-row__detail">Notes: {project.notes}</div>}
    </div><div className="actions"><Button size="sm" disabled={busy!==null} onClick={()=>startEdit(project)}>Edit</Button>
    <Button size="sm" variant="ghost" disabled={busy!==null} onClick={()=>{setEditing(null);setStatusEditing(project.id);setStatusReason('');setError('');}}>
      {project.status==='archived'?'Reopen':'Archive'}</Button></div></div>
    {statusEditing===project.id&&<form className="inline-form form-grid" aria-label={'Change project status '+project.project_code} onSubmit={e=>{e.preventDefault();void toggle(project);}}>
      <TextField label="Status reason" className="form-grid__wide" hint="Saved in the audit trail with the change." required maxLength={500} value={statusReason} onChange={e=>setStatusReason(e.target.value)}/>
      <div className="actions form-grid__full">
      <Button variant="primary" loading={busy===project.id} disabled={busy!==null} type="submit">Confirm {project.status==='archived'?'reopen':'archive'}</Button>
      <Button variant="ghost" disabled={busy!==null} type="button" onClick={()=>{setStatusEditing(null);setStatusReason('');}}>Cancel status change</Button></div>
    </form>}
    {editing===project.id&&<form className="inline-form form-grid" aria-label={'Edit project '+project.project_code} onSubmit={e=>{e.preventDefault();save(project.id);}}>
      <TextField label="Code" required maxLength={60} value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value})}/>
      <TextField label="Customer" required maxLength={200} value={draft.customer} onChange={e=>setDraft({...draft,customer:e.target.value})}/>
      <TextField label="Site address" required maxLength={300} value={draft.siteAddress} onChange={e=>setDraft({...draft,siteAddress:e.target.value})}/>
      <TextField label="Project name" optional maxLength={200} value={draft.details.name} onChange={e=>setDraft({...draft,details:{...draft.details,name:e.target.value}})}/>
      <TextField label="Billing address" optional maxLength={600} value={draft.details.billingAddress} onChange={e=>setDraft({...draft,details:{...draft.details,billingAddress:e.target.value}})}/>
      <TextArea label="Project notes" optional className="form-grid__full" maxLength={2000} value={draft.details.notes} onChange={e=>setDraft({...draft,details:{...draft.details,notes:e.target.value}})}/>
      <div className="actions form-grid__full">
      <Button variant="primary" loading={busy===project.id} disabled={busy!==null} type="submit">Save changes</Button>
      <Button type="button" variant="ghost" disabled={busy!==null} onClick={()=>setEditing(null)}>Cancel</Button></div>
    </form>}
    </li>)}</ul>{error&&<p className="inline-error" role="alert">{error}</p>}</>;
}
