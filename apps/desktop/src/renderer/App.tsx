import {useEffect,useMemo,useRef,useState} from 'react';
import {BusinessBranding} from './features/settings/BusinessBranding';
import {BackupLocation} from './features/settings/BackupLocation';
import {ProjectsPanel,type ProjectRow} from './features/projects/ProjectsPanel';
import {AppShell,useRouterState} from './shell/AppShell';
import {ComingSoonScreen,Screen} from './shell/Screen';
import {createRouter} from './shell/router';
import {ROUTES,routeDefinition} from './shell/routes';
import {GlassCard} from './components/GlassCard';
import {AppearanceSetting} from './features/settings/AppearanceSetting';
import {ComponentsPage} from './features/design-system/ComponentsPage';
import {Button,Stat,TextArea,TextField,useToast} from './components/ui';
export default function App(){
  const [router]=useState(()=>createRouter());
  const nav=useRouterState(router);
  const toast=useToast();
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
  const activeCount=projects.filter(p=>p.status!=='archived').length;
  const archivedCount=projects.length-activeCount;
  const paletteProjects=useMemo(()=>projects.map(p=>({id:p.id,code:p.project_code,customer:p.customer_name,name:p.project_name,archived:p.status==='archived'})),[projects]);
  const checkHealth=()=>{void run('Health',()=>window.tmBridge.ping()).then(ok=>toast(ok
    ?{title:'Desktop services are healthy',body:'Details are in Settings, Foundation tools.',tone:'success'}
    :{title:'Health check did not pass',body:'Details are in Settings, Foundation tools.',tone:'danger'}));};
  const back=nav.previous&&nav.previous!=='components'?nav.previous:'settings';
  const feedback=<div aria-live="polite" className="feedback" role="status">{message}</div>;
  return <AppShell router={router} state={nav} projects={paletteProjects} onCheckHealth={checkHealth}>
    {/* Jobs and Settings stay mounted while hidden, so drafts survive a trip to another
        screen and a restore locks every working control at once. */}
    <fieldset className="operation-scope" aria-label="Local operations" disabled={restoring} aria-busy={restoring}>
    <Screen id="jobs" active={nav.route==='jobs'} actions={<Button variant="primary" icon="plus" onClick={()=>router.navigate('jobs',{focus:{elementId:'new-project-code'}})}>New project</Button>}>
    <div className="stat-strip" aria-label="Project counts">
      <Stat label="Saved projects" value={projectsReady?String(projects.length):'...'}/>
      <Stat label="Active" value={projectsReady?String(activeCount):'...'} tone={activeCount>0?'success':'neutral'}/>
      <Stat label="Archived" value={projectsReady?String(archivedCount):'...'}/>
    </div>
    <GlassCard title="Projects" description="Fictional jobs only. Each one keeps its code, customer and job-site address.">
      <form className="form-grid" aria-label="New project" onSubmit={async(e)=>{e.preventDefault();if(createLock.current||!projectsReady||operations.current.restoring)return;createLock.current=true;setCreating(true);try{await run('Create project',async()=>{const result=await window.tmBridge.createProject({code,customer,siteAddress,details});await refresh();return result;});}finally{createLock.current=false;setCreating(false);}}}>
        <TextField id="new-project-code" label="Project code" value={code} onChange={e=>setCode(e.target.value)} required maxLength={60}/>
        <TextField label="Customer" value={customer} onChange={e=>setCustomer(e.target.value)} required maxLength={200}/>
        <TextField label="Job-site address" value={siteAddress} onChange={e=>setAddress(e.target.value)} required maxLength={300}/>
        <TextField label="Project name" optional value={details.name} onChange={e=>setDetails({...details,name:e.target.value})} maxLength={200}/>
        <TextField label="Billing address" optional value={details.billingAddress} onChange={e=>setDetails({...details,billingAddress:e.target.value})} maxLength={600}/>
        <TextArea label="Project notes" optional className="form-grid__full" value={details.notes} onChange={e=>setDetails({...details,notes:e.target.value})} maxLength={2000}/>
        <div className="actions form-grid__full">
          <Button type="submit" variant="primary" icon="plus" loading={creating} disabled={!projectsReady}>{creating?'Saving project...':'Create fictional project'}</Button>
          <Button type="button" variant="ghost" onClick={()=>run('List projects',async()=>{await refresh();return 'Updated';})}>Refresh</Button>
        </div>
      </form>
      {nav.route==='jobs'&&feedback}
      <p className="project-status" role="status">{projectStatus}</p>
      <ProjectsPanel key={restoreGeneration} projects={projects} ready={projectsReady} onChanged={refresh} track={track}/>
    </GlassCard>
    </Screen>
    <Screen id="settings" active={nav.route==='settings'}>
    <div className="settings-grid"><BusinessBranding key={restoreGeneration} track={track}/>
      <div className="settings-stack"><AppearanceSetting/><BackupLocation track={track}/></div></div>
    <GlassCard title="Foundation tools" description="Verify the desktop services, imports, document export, backups and protected fake-token workflow.">
      <div className="actions">
        <Button icon="check" onClick={()=>run('Health',()=>window.tmBridge.ping())}>Check health</Button>
        <Button onClick={()=>run('Receipt import',()=>window.tmBridge.importReceiptImage())}>Import test photo</Button>
        <Button icon="file" onClick={()=>run('Invoice PDF',()=>window.tmBridge.saveSyntheticPdf())}>Save synthetic PDF</Button>
        <Button disabled={restoring||pending>0} loading={restoring} onClick={()=>void restore()}>Restore verified backup</Button>
        <Button variant="ghost" onClick={()=>run('Secure fake token',()=>window.tmBridge.storeFakeSecretProof())}>Store FAKE token</Button>
        <Button variant="ghost" onClick={()=>run('Check fake token',()=>window.tmBridge.checkFakeSecretProof())}>Check fake token</Button>
        <Button variant="ghost" onClick={()=>run('Revoke fake token',()=>window.tmBridge.removeFakeSecretProof())}>Revoke fake token</Button>
      </div>
      {nav.route!=='jobs'&&feedback}
    </GlassCard>
    </Screen>
    </fieldset>
    {ROUTES.filter(r=>r.coming&&r.id===nav.route).map(r=><ComingSoonScreen key={r.id} id={r.id} onNavigate={route=>router.navigate(route,{focus:'heading'})}/>)}
    {nav.route==='components'&&<section className="screen screen--components" data-screen="components" aria-label="Components">
      <ComponentsPage backLabel={'Back to '+routeDefinition(back).label} onBack={()=>router.navigate(back,{focus:'heading'})}/></section>}
  </AppShell>;
}
