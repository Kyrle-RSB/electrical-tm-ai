import {useEffect, useState} from 'react';
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
  const [restoreGeneration,setRestoreGeneration]=useState(0);
  const run=async(name:string,fn:()=>Promise<unknown>)=>{
    setMessage('Running '+name+'...');
    try{const result=await fn();setMessage(name+': '+JSON.stringify(result));return true;}
    catch(error){setMessage(name+' failed: '+String(error));return false;}
  };
  const refresh=async()=>{
    try{const saved=await window.tmBridge.listProjectsDetailed();
      setProjects(saved);
      setProjectStatus(saved.length===0?'No fictional projects saved yet.':`${saved.length} saved fictional project(s).`);
    }catch(error){setProjectStatus('Unable to load saved projects: '+String(error));throw error;}
  };
  useEffect(()=>{let active=true;window.tmBridge.listProjectsDetailed().then(saved=>{
    if(!active)return;setProjects(saved);
    setProjectStatus(saved.length===0?'No fictional projects saved yet.':`${saved.length} saved fictional project(s).`);
  }).catch(error=>{if(active)setProjectStatus('Unable to load saved projects: '+String(error));});
    return()=>{active=false;};
  },[]);
  return <CockpitShell>
    <div className="intro-row"><div><h1>Local foundation cockpit</h1>
      <p>One operator, one business. A real Electron foundation, not yet approved for customer billing.</p></div>
      <div className="pill">Phase 2 · Development</div></div>
    <GlassCard title="Foundation tools">
      <p className="muted">Verify the desktop services, imports, document export, backups and protected fake-token workflow.</p>
      <div className="actions">
        <button onClick={()=>run('Health',()=>window.tmBridge.ping())}>Check health</button>
        <button onClick={()=>run('Receipt import',()=>window.tmBridge.importReceiptImage())}>Import test photo</button>
        <button onClick={()=>run('Invoice PDF',()=>window.tmBridge.saveSyntheticPdf())}>Save synthetic PDF</button>
        <button onClick={()=>run('Restore',async()=>{const result=await window.tmBridge.chooseBackupAndRestore();if(result){await refresh();setRestoreGeneration(v=>v+1);}return result;})}>Restore verified backup</button>
        <button onClick={()=>run('Secure fake token',()=>window.tmBridge.storeFakeSecretProof())}>Store FAKE token</button>
        <button onClick={()=>run('Check fake token',()=>window.tmBridge.checkFakeSecretProof())}>Check fake token</button>
      </div>
      <div aria-live="polite" className="feedback" role="status">{message}</div>
    </GlassCard>
    <GlassCard title="Projects">
      <form onSubmit={async(e)=>{e.preventDefault();const ok=await run('Create project',()=>window.tmBridge.createProject({code,customer,siteAddress}));if(ok)await refresh();}}>
        <label>Project code<input value={code} onChange={e=>setCode(e.target.value)} required maxLength={60}/></label>
        <label>Customer<input value={customer} onChange={e=>setCustomer(e.target.value)} required maxLength={200}/></label>
        <label>Job-site address<input value={siteAddress} onChange={e=>setAddress(e.target.value)} required maxLength={300}/></label>
        <button type="submit">Create fictional project</button>
        <button type="button" onClick={()=>run('List projects',async()=>{await refresh();return 'Updated';})}>Refresh</button>
      </form>
      <p className="project-status" role="status">{projectStatus}</p>
      <ProjectsPanel projects={projects} onChanged={refresh}/>
    </GlassCard>
    <div className="settings-grid"><BusinessBranding key={restoreGeneration}/><BackupLocation/></div>
  </CockpitShell>;
}
