import {useState} from 'react';
export type ProjectRow={id:string;project_code:string;customer_name:string;site_address:string;
 status:string;project_name:string;billing_address:string;notes:string};
export function ProjectsPanel({projects,onChanged}:{projects:ProjectRow[];onChanged:()=>Promise<void>}){
 const [error,setError]=useState('');const [busy,setBusy]=useState<string|null>(null);
 const [editing,setEditing]=useState<string|null>(null);
 const [draft,setDraft]=useState({code:'',customer:'',siteAddress:''});
 const startEdit=(p:ProjectRow)=>{setEditing(p.id);setDraft({code:p.project_code,customer:p.customer_name,siteAddress:p.site_address});setError('');};
 async function toggle(project:ProjectRow){
  setBusy(project.id);setError('');try{
    await window.tmBridge.setProjectStatus({id:project.id,status:project.status==='archived'?'active':'archived'});
    await onChanged();
  }catch(err){setError(String(err));}finally{setBusy(null);}
 }
 async function save(id:string){
  setBusy(id);setError('');try{
   await window.tmBridge.updateProject({id,...draft});setEditing(null);await onChanged();
  }catch(err){setError('Unable to save project: '+String(err));}
  finally{setBusy(null);}
 }
 return <><ul className="project-list">{projects.map(project=><li key={project.id}>
    <div className="project-row"><div><strong>{project.project_code}</strong>
      <span className="project-status-label">{project.status}</span><div>{project.customer_name} · {project.site_address}</div>
      {project.project_name&&<small>{project.project_name}</small>}
    </div><div className="actions"><button type="button" disabled={busy===project.id} onClick={()=>startEdit(project)}>Edit</button>
    <button type="button" disabled={busy===project.id} onClick={()=>toggle(project)}>
      {project.status==='archived'?'Reopen':'Archive'}</button></div></div>
    {editing===project.id&&<form aria-label={'Edit project '+project.project_code} onSubmit={e=>{e.preventDefault();save(project.id);}}>
      <label>Code<input required maxLength={60} value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value})}/></label>
      <label>Customer<input required maxLength={200} value={draft.customer} onChange={e=>setDraft({...draft,customer:e.target.value})}/></label>
      <label>Site address<input required maxLength={300} value={draft.siteAddress} onChange={e=>setDraft({...draft,siteAddress:e.target.value})}/></label>
      <button disabled={busy===project.id} type="submit">Save changes</button>
      <button type="button" onClick={()=>setEditing(null)}>Cancel</button>
    </form>}
    </li>)}</ul>{error&&<p role="alert">{error}</p>}</>;
}
