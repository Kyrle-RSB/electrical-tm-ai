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
