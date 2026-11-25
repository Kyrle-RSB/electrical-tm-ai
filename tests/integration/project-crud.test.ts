import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
import {validateProjectEditInput} from '../../packages/contracts/src/ipc/request-envelope';
test('project create/edit/archive survives database restart with audit history',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-crud-'));
 const file=path.join(root,'app.sqlite'),migrations='packages/persistence-sqlite/src/migrations';
 try{
  let db=new LocalStore(file,migrations);db.initializeFictionalCompany();
  assert.equal(db.isFirstRunComplete(),false);
  const id=db.createProject({code:'PR-01',customer:'Demo',siteAddress:'Old Road'});
  db.updateProject(id,{code:'PR-02',customer:'Updated',siteAddress:'New Road'});
  db.setProjectStatus(id,'archived');db.close();db=new LocalStore(file,migrations);
  const row=db.listProjectsDetailed()[0];assert.equal(row.project_code,'PR-02');assert.equal(row.site_address,'New Road');
  assert.equal(row.status,'archived');
  assert.deepEqual(db.db.prepare('SELECT action FROM audit_events ORDER BY id').all().map((x:any)=>x.action),
   ['project.create','project.edit','project.status.archived']);
  assert.throws(()=>db.updateProject('00000000-0000-4000-8000-000000000000',{code:'PR-03',customer:'X',siteAddress:'Y'}),/not found/);
  assert.throws(()=>validateProjectEditInput({id,code:'A',customer:'B',siteAddress:'C',admin:true}),/Unexpected/);
  db.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('project create and edit contracts preserve distinct billing/site fields atomically',async()=>{
 const {registerFoundationHandlers}=await import('../../apps/desktop/src/main/ipc/register');
 const {CHANNELS}=await import('../../packages/contracts/src/ipc/channel-map');
 const {randomUUID}=await import('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-project-details-'));const file=path.join(root,'app.sqlite');
 let db=new LocalStore(file);db.initializeFictionalCompany();
 try{
  const primary={id:31},url='tmapp://app/index.html',frame:any={url};frame.top=frame;
  const handlers=new Map<string,(e:any,r:unknown)=>Promise<unknown>>();
  registerFoundationHandlers({handle:(ch,h)=>handlers.set(ch,h)},{primary,url,getStore:()=>db});
  const invoke=(ch:string,payload:unknown)=>handlers.get(ch)!({sender:primary,senderFrame:frame},{requestId:randomUUID(),version:1,payload});
  const input={code:'DETAILS-01',customer:'Synthetic Customer',siteAddress:'1 Site Rd',details:{name:'Fictional panel',billingAddress:'99 Billing Rd',notes:'Original notes'}};
  const {projectId:id}=await invoke(CHANNELS.projectAdd,input) as {projectId:string};
  assert.equal(db.listProjectsDetailed()[0].billing_address,'99 Billing Rd');
  await invoke(CHANNELS.projectEdit,{id,...input,code:'DETAILS-02',details:{...input.details,notes:'Updated notes'}});
  db.close();db=new LocalStore(file);
  const row=db.listProjectsDetailed()[0];assert.equal(row.id,id);assert.equal(row.site_address,'1 Site Rd');assert.equal(row.billing_address,'99 Billing Rd');assert.equal(row.notes,'Updated notes');assert.equal(row.project_name,'Fictional panel');
  assert.deepEqual(db.db.prepare('SELECT action FROM audit_events ORDER BY id').all().map((x:any)=>x.action),['project.create','project.edit']);
  await invoke(CHANNELS.projectEdit,{id,code:'DETAILS-03',customer:'Synthetic Customer',siteAddress:'Changed site'});
  assert.equal(db.listProjectsDetailed()[0].billing_address,'99 Billing Rd');
  await invoke(CHANNELS.projectAdd,{code:'OTHER',customer:'Other',siteAddress:'Other site'});
  await assert.rejects(()=>invoke(CHANNELS.projectEdit,{id,...input,code:'OTHER',details:{...input.details,notes:'Must not persist'}}));
  assert.equal(db.listProjectsDetailed().find(x=>x.id===id)?.notes,'Updated notes');
  await assert.rejects(()=>invoke(CHANNELS.projectEdit,{id,...input,details:{name:'Invalid',billingAddress:3,notes:''}}));
  assert.equal(db.listProjectsDetailed().find(x=>x.id===id)?.notes,'Updated notes');
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('explicit archive/reopen reasons persist atomically with audit history and malformed reasons cannot mutate',async()=>{
 const {registerFoundationHandlers}=await import('../../apps/desktop/src/main/ipc/register');
 const {CHANNELS}=await import('../../packages/contracts/src/ipc/channel-map');
 const {randomUUID}=await import('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-project-status-reason-')),file=path.join(root,'app.sqlite');
 let db=new LocalStore(file);db.initializeFictionalCompany();
 try{
  const id=db.createProject({code:'REASON-01',customer:'Synthetic',siteAddress:'Site'});
  const original=db.listProjectsDetailed()[0];const primary={id:51},url='tmapp://app/index.html',frame:any={url};frame.top=frame;
  const handlers=new Map<string,(e:any,r:unknown)=>Promise<unknown>>();
  registerFoundationHandlers({handle:(ch,h)=>handlers.set(ch,h)},{primary,url,getStore:()=>db});
  const invoke=(payload:unknown)=>handlers.get(CHANNELS.projectStatus)!({sender:primary,senderFrame:frame},{requestId:randomUUID(),version:1,payload});
  await invoke({id,status:'archived',reason:'Synthetic work concluded'});
  const archived=db.listProjectsDetailed()[0];assert.equal(archived.status,'archived');assert.equal(archived.opened_utc,original.opened_utc);
  const audit=()=>db.db.prepare('SELECT action,entity_id,reason FROM audit_events ORDER BY id').all();
  const receipts=()=>db.db.prepare('SELECT * FROM operation_receipts ORDER BY operation_id').all();
  const beforeAudit=audit(),beforeReceipts=receipts();
  for(const reason of ['', '  ', 'x'.repeat(501), 3]){await assert.rejects(invoke({id,status:'active',reason}));assert.deepEqual(db.listProjectsDetailed()[0],archived);assert.deepEqual(audit(),beforeAudit);assert.deepEqual(receipts(),beforeReceipts);}
  await invoke({id,status:'active',reason:'Synthetic service resumed'});
  db.close();db=new LocalStore(file);
  assert.deepEqual(db.listProjectsDetailed()[0],original);
  assert.deepEqual(audit().map(x=>({...x})),[{action:'project.create',entity_id:id,reason:null},{action:'project.status.archived',entity_id:id,reason:'Synthetic work concluded'},{action:'project.status.active',entity_id:id,reason:'Synthetic service resumed'}]);
  // A preexisting typed client without a reason remains supported, with honest operation-only metadata.
  db.setProjectStatus(id,'archived');assert.equal(audit().at(-1)?.reason,'Local operator selected archived');
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('application project get is scoped to local business and read-only across restart',async()=>{
 const {createProjectUseCases}=await import('../../packages/application/src');
 const {randomUUID}=await import('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-project-get-')),file=path.join(root,'app.sqlite');
 let store=new LocalStore(file);store.initializeFictionalCompany();
 try{
  const id=store.createProject({code:'GET-01',customer:'Synthetic',siteAddress:'Site',details:{name:'Fixture',billingAddress:'Billing',notes:'Notes'}});
  store.createProject({code:'GET-02',customer:'Second',siteAddress:'Other'});
  const original=store.listProjectsDetailed().find(x=>x.id===id)!;
  const count=()=>({audit:store.db.prepare('SELECT COUNT(*) AS n FROM audit_events').get()?.n,operations:store.db.prepare('SELECT COUNT(*) AS n FROM operation_receipts').get()?.n});
  const before=count();const useCases=createProjectUseCases(store);
  assert.deepEqual(useCases.get(id),original);assert.equal(useCases.get(randomUUID()),null);
  assert.throws(()=>useCases.get('not-a-project-id'),/Invalid project identity/);
  // Existing schema can contain a foreign business through direct SQL; the local lookup must not expose it.
  const foreign=randomUUID();store.db.prepare('INSERT INTO business_profiles(id,legal_name) VALUES(?,?)').run('synthetic-foreign','Synthetic other');
  store.db.prepare('INSERT INTO projects(id,business_id,project_code,customer_name,site_address,opened_utc) VALUES(?,?,?,?,?,?)').run(foreign,'synthetic-foreign','FOREIGN','Synthetic other','Other','2026-11-24T00:00:00Z');
  assert.equal(useCases.get(foreign),null);assert.equal(useCases.list().some(x=>x.id===foreign),false);assert.equal(useCases.listDetailed().some(x=>x.id===foreign),false);
  const foreignBefore=store.db.prepare('SELECT * FROM projects WHERE id=?').get(foreign);
  assert.throws(()=>useCases.edit(randomUUID(),{id:foreign,code:'CHANGED',customer:'Other',siteAddress:'Other'}),/not found/);
  assert.throws(()=>useCases.details(randomUUID(),{id:foreign,name:'Changed',billingAddress:'Other',notes:''}),/not found/);
  assert.throws(()=>useCases.status(randomUUID(),{id:foreign,status:'archived'}),/not found/);
  assert.deepEqual(store.db.prepare('SELECT * FROM projects WHERE id=?').get(foreign),foreignBefore);assert.equal(store.db.prepare('SELECT * FROM project_details WHERE project_id=?').get(foreign),undefined);assert.deepEqual(count(),before);
  store.close();store=new LocalStore(file);
  assert.deepEqual(createProjectUseCases(store).get(id),original);assert.deepEqual(count(),before);
 }finally{store.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
