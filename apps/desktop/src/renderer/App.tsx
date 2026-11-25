import {useEffect, useRef, useState} from 'react';
import {BusinessBranding} from './features/settings/BusinessBranding';
import {BackupLocation} from './features/settings/BackupLocation';
import {ProjectsPanel,type ProjectRow} from './features/projects/ProjectsPanel';
import {CockpitShell} from './shell/CockpitShell';
import {GlassCard} from './components/GlassCard';
export default function App(){
  const [message,setMessage]=useState('Foundation ready. Synthetic data only.');
  const [projects,setProjects]=useState<ProjectRow[]>([]);
  const [projectStatus,setProjectStatus]=useState('Loading saved fictional projects...');
  const [code,setCode]=useState('SYN-001');
  const [customer,setCustomer]=useState('Fictional Contractor');
  const [siteAddress,setAddress]=useState('101 Sample Road');
  const [details,setDetails]=useState({name:'',billingAddress:'',notes:''});
  const [creating,setCreating]=useState(false);
  const createLock=useRef(false);
  const [restoreGeneration,setRestoreGeneration]=useState(0);
  const generation=useRef(0);
  const operations=useRef({pending:0,restoring:false});
  const [pending,setPending]=useState(0);
  const [restoring,setRestoring]=useState(false);
  const [projectsReady,setProjectsReady]=useState(false);
  // Synchronous admission prevents a pre-restore edit from being queued against restored data.
  const track=async<T,>(action:()=>Promise<T>):Promise<T>=>{
    if(operations.current.restoring||restoreGeneration!==generation.current)throw new Error('Restore in progress or data view changed');
    operations.current.pending++;setPending(operations.current.pending);
    try{return await action();}
    finally{operations.current.pending--;setPending(operations.current.pending);}
  };
  const run=async(name:string,fn:()=>Promise<unknown>)=>{
    if(operations.current.restoring||restoreGeneration!==generation.current)return false;
    setMessage('Running '+name+'...');
    try{return await track(async()=>{const result=await fn();setMessage(name+': '+JSON.stringify(result));return true;});}
    catch(error){setMessage(name+' failed: '+String(error));return false;}
  };
  const refresh=async()=>{
    try{const saved=await window.tmBridge.listProjectsDetailed();
      setProjects(saved);setProjectsReady(true);
      setProjectStatus(saved.length===0?'No fictional projects saved yet.':`${saved.length} saved fictional project(s).`);
    }catch(error){setProjects([]);setProjectsReady(false);setProjectStatus('Unable to load saved projects: '+String(error));throw error;}
  };
  useEffect(()=>{let active=true;const epoch=generation.current;window.tmBridge.listProjectsDetailed().then(saved=>{
    if(!active||epoch!==generation.current)return;setProjects(saved);setProjectsReady(true);
    setProjectStatus(saved.length===0?'No fictional projects saved yet.':`${saved.length} saved fictional project(s).`);
  }).catch(error=>{if(active&&epoch===generation.current){setProjectsReady(false);setProjectStatus('Unable to load saved projects: '+String(error));}});
    return()=>{active=false;};
  },[]);
  const restore=async()=>{
    if(operations.current.restoring||operations.current.pending>0||restoreGeneration!==generation.current)return;
    operations.current.restoring=true;setRestoring(true);setMessage('Restore in progress...');
    try{
      const result=await window.tmBridge.chooseBackupAndRestore();
      if(result===null){setMessage('Restore cancelled. Current records and drafts unchanged.');return;}
      // The main process has committed the restore. Do not retain any prior database-backed draft.
      generation.current++;setRestoreGeneration(generation.current);
      setProjects([]);setProjectsReady(false);setProjectStatus('Loading restored projects...');
      setCode('SYN-001');setCustomer('Fictional Contractor');setAddress('101 Sample Road');
      setDetails({name:'',billingAddress:'',notes:''});
      const recovery=result.rollbackPath?' Rollback copy: '+result.rollbackPath:'';
      try{await refresh();setMessage('Restore completed. Project records reloaded.'+recovery);}
      catch{setMessage('Restore completed, but project reload failed. Use Refresh before editing projects.'+recovery);}
    }catch(error){setMessage('Restore failed: '+String(error));}
    finally{operations.current.restoring=false;setRestoring(false);}
  };
  return <CockpitShell>
    <div className="intro-row"><div><h1>Local foundation cockpit</h1>
      <p>One operator, one business. A real Electron foundation, not yet approved for customer billing.</p></div>
      <div className="pill">Phase 2 · Development</div></div>
    <fieldset className="operation-scope" aria-label="Local operations" disabled={restoring} aria-busy={restoring}>
    <GlassCard title="Foundation tools">
      <p className="muted">Verify the desktop services, imports, document export, backups and protected fake-token workflow.</p>
      <div className="actions">
        <button onClick={()=>run('Health',()=>window.tmBridge.ping())}>Check health</button>
        <button onClick={()=>run('Receipt import',()=>window.tmBridge.importReceiptImage())}>Import test photo</button>
        <button onClick={()=>run('Invoice PDF',()=>window.tmBridge.saveSyntheticPdf())}>Save synthetic PDF</button>
        <button disabled={restoring||pending>0} onClick={()=>void restore()}>Restore verified backup</button>
        <button onClick={()=>run('Secure fake token',()=>window.tmBridge.storeFakeSecretProof())}>Store FAKE token</button>
        <button onClick={()=>run('Check fake token',()=>window.tmBridge.checkFakeSecretProof())}>Check fake token</button>
        <button onClick={()=>run('Revoke fake token',()=>window.tmBridge.removeFakeSecretProof())}>Revoke fake token</button>
      </div>
      <div aria-live="polite" className="feedback" role="status">{message}</div>
    </GlassCard>
    <GlassCard title="Projects">
      <form onSubmit={async(e)=>{e.preventDefault();if(createLock.current||!projectsReady||operations.current.restoring)return;createLock.current=true;setCreating(true);try{await run('Create project',async()=>{const result=await window.tmBridge.createProject({code,customer,siteAddress,details});await refresh();return result;});}finally{createLock.current=false;setCreating(false);}}}>
        <label>Project code<input value={code} onChange={e=>setCode(e.target.value)} required maxLength={60}/></label>
        <label>Customer<input value={customer} onChange={e=>setCustomer(e.target.value)} required maxLength={200}/></label>
        <label>Job-site address<input value={siteAddress} onChange={e=>setAddress(e.target.value)} required maxLength={300}/></label>
        <label>Project name<input value={details.name} onChange={e=>setDetails({...details,name:e.target.value})} maxLength={200}/></label>
        <label>Billing address<input value={details.billingAddress} onChange={e=>setDetails({...details,billingAddress:e.target.value})} maxLength={600}/></label>
        <label>Project notes<textarea value={details.notes} onChange={e=>setDetails({...details,notes:e.target.value})} maxLength={2000}/></label>
        <button type="submit" disabled={creating||!projectsReady}>{creating?'Saving project...':'Create fictional project'}</button>
        <button type="button" onClick={()=>run('List projects',async()=>{await refresh();return 'Updated';})}>Refresh</button>
      </form>
      <p className="project-status" role="status">{projectStatus}</p>
      <ProjectsPanel key={restoreGeneration} projects={projects} onChanged={refresh} track={track}/>
    </GlassCard>
    <div className="settings-grid"><BusinessBranding key={restoreGeneration} track={track}/><BackupLocation track={track}/></div>
    </fieldset>
  </CockpitShell>;
}
