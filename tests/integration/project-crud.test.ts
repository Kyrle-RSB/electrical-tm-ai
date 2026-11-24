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
