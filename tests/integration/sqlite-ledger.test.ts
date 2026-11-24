import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {withImmediateTransaction} from '../../packages/persistence-sqlite/src/transactions/unit-of-work';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'tm-p2-sqlite-'));
test('historical migrations apply exactly once, business and project details survive restart',()=>{
 const dir=temp();try{
  const file=path.join(dir,'app.sqlite');let store=new LocalStore(file);store.initializeFictionalCompany();
  assert.deepEqual((store.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {version:number}[]).map(x=>x.version),[1,2,3,4,5,6]);
  const id=store.createProject({code:'SITE-01',customer:'Synthetic Customer',siteAddress:'101 Example'});
  store.updateBusinessProfile({legalName:'Demo Electric',tradeName:'Demo',phone:'555',email:'demo@example.test',mailingAddress:'PO Box 2',taxId:'TEST-TAX',contractorLicense:'TEST-ELEC'});
  store.updateProjectDetails(id,{name:'Panel change',billingAddress:'100 Billing St',notes:'Saturday work'});
  store.setProjectStatus(id,'complete');store.close();store=new LocalStore(file);
  assert.equal(store.getBusinessProfile().contractorLicense,'TEST-ELEC');
  assert.equal(store.listProjectsDetailed()[0].billing_address,'100 Billing St');
  assert.equal(store.listProjectsDetailed()[0].status,'complete');
  assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as any).count,6);
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

test('missing middle migration record fails closed without rewriting history',()=>{
 const dir=temp();try{
  const file=path.join(dir,'app.sqlite');let db=new LocalStore(file);db.initializeFictionalCompany();
  db.createProject({code:'HISTORY-GAP',customer:'Synthetic',siteAddress:'1 Test Road'});
  db.db.prepare('DELETE FROM schema_migrations WHERE version=2').run();
  const before=db.db.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all();db.close();
  assert.throws(()=>new LocalStore(file),/Migration history mismatch/);
  const {DatabaseSync}=require('node:sqlite') as typeof import('node:sqlite');
  const inspect=new DatabaseSync(file,{readOnly:true});try{
   assert.deepEqual(inspect.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all(),before);
   assert.equal((inspect.prepare('SELECT count(*) AS n FROM projects').get() as {n:number}).n,1);
  }finally{inspect.close();}
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});


test('two independent SQLite connections safely conflict and retry without duplicate invoice allocation or audit rows',()=>{
 const dir=temp(),file=path.join(dir,'ledger.sqlite');
 let first:LocalStore|undefined,second:DatabaseSync|undefined;
 try{
  first=new LocalStore(file);first.initializeFictionalCompany();
  const project=first.createProject({code:'CONTENTION',customer:'Synthetic',siteAddress:'Test'});
  second=new DatabaseSync(file,{timeout:0});second.exec('PRAGMA foreign_keys=ON; PRAGMA recursive_triggers=ON; PRAGMA busy_timeout=0;');
  const write=(db:DatabaseSync,id:string,number:string)=>{
   db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('synthetic.reserve',id,'2026-11-23T00:00:00Z');
   db.prepare('INSERT INTO issued_invoices(id,project_id,invoice_number,immutable_body_json,issued_utc,amount_cents,pdf_sha256,pdf_locator) VALUES(?,?,?,?,?,?,?,?)').run(id,project,number,'{}','2026-11-23T00:00:00Z',1000,'a'.repeat(64),'issued/synthetic.pdf');
  };
  const a=first.db,b=second;
  withImmediateTransaction(a,()=>{
   write(a,'first','SYN-001');
   assert.throws(()=>withImmediateTransaction(b,()=>write(b,'second','SYN-001')),/locked|busy/i);
   assert.equal((b.prepare('SELECT count(*) AS n FROM issued_invoices').get() as {n:number}).n,0);
  });
  assert.throws(()=>withImmediateTransaction(b,()=>write(b,'second','SYN-001')),/UNIQUE constraint/i);
  assert.throws(()=>withImmediateTransaction(b,()=>{write(b,'rollback','SYN-002');throw new Error('Synthetic interruption after reservation');}),/interruption/);
  withImmediateTransaction(b,()=>write(b,'retry','SYN-002'));
  second.close();second=undefined;first.close();first=undefined;
  first=new LocalStore(file);
  assert.deepEqual(first.db.prepare('SELECT invoice_number,id FROM issued_invoices ORDER BY invoice_number').all().map(r=>[r.invoice_number,r.id]),[['SYN-001','first'],['SYN-002','retry']]);
  assert.deepEqual(first.db.prepare("SELECT entity_id FROM audit_events WHERE action='synthetic.reserve' ORDER BY entity_id").all().map(r=>r.entity_id),['first','retry']);
  assert.equal((first.db.prepare('PRAGMA quick_check').get() as {quick_check:string}).quick_check,'ok');
  assert.deepEqual(first.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{second?.close();first?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
