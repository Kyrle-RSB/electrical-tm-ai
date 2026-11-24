import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'tm-p2-sqlite-'));
test('historical migrations apply exactly once, business and project details survive restart',()=>{
 const dir=temp();try{
  const file=path.join(dir,'app.sqlite');let store=new LocalStore(file);store.initializeFictionalCompany();
  assert.deepEqual((store.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {version:number}[]).map(x=>x.version),[1,2,3,4,5]);
  const id=store.createProject({code:'SITE-01',customer:'Synthetic Customer',siteAddress:'101 Example'});
  store.updateBusinessProfile({legalName:'Demo Electric',tradeName:'Demo',phone:'555',email:'demo@example.test',mailingAddress:'PO Box 2',taxId:'TEST-TAX',contractorLicense:'TEST-ELEC'});
  store.updateProjectDetails(id,{name:'Panel change',billingAddress:'100 Billing St',notes:'Saturday work'});
  store.setProjectStatus(id,'complete');store.close();store=new LocalStore(file);
  assert.equal(store.getBusinessProfile().contractorLicense,'TEST-ELEC');
  assert.equal(store.listProjectsDetailed()[0].billing_address,'100 Billing St');
  assert.equal(store.listProjectsDetailed()[0].status,'complete');
  assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as any).count,5);
  store.setProjectStatus(id,'archived');store.setProjectStatus(id,'active');
  assert.equal(store.listProjectsDetailed()[0].status,'active');
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('migration tamper detection refuses altered installed SQL',()=>{
 const dir=temp();try{
  const migrationRoot=path.resolve('packages/persistence-sqlite/src/migrations');const tmp=path.join(dir,'migrations');fs.cpSync(migrationRoot,tmp,{recursive:true});
  const dbFile=path.join(dir,'app.sqlite');new LocalStore(dbFile,tmp).close();
  fs.appendFileSync(path.join(tmp,'0002-material-dispositions.sql'),'\n-- tamper\n');
  assert.throws(()=>new LocalStore(dbFile,tmp),/Migration history mismatch/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
