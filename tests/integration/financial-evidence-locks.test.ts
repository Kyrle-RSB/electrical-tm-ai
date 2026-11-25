import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
const migrations='packages/persistence-sqlite/src/migrations';
const stamp='2026-11-23T00:00:00Z';
test('issued credit, recorded payment and approved email draft are frozen',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-evidence-locks-'));
 try{
  const store=new LocalStore(path.join(dir,'db.sqlite'),migrations);store.initializeFictionalCompany();
  const id=store.createProject({code:'LOCKS',customer:'Demo',siteAddress:'Site'}),db=store.db;
  db.prepare('INSERT INTO issued_invoices(id,project_id,invoice_number,immutable_body_json,issued_utc,amount_cents,pdf_sha256,pdf_locator) VALUES(?,?,?,?,?,?,?,?)')
    .run('inv',id,'D-001','{}',stamp,10000,'a'.repeat(64),'issued/a.pdf');
  db.prepare('INSERT INTO credit_notes(id,invoice_id,credit_number,amount_cents,reason,issued_utc,body_json) VALUES(?,?,?,?,?,?,?)')
    .run('credit','inv','CN-001',100,'Adjustment',stamp,'{}');
  db.prepare('INSERT INTO payment_events(id,invoice_id,amount_cents,paid_day,method,recorded_utc) VALUES(?,?,?,?,?,?)')
    .run('payment','inv',100,'2026-11-23','cash',stamp);
  db.prepare('INSERT INTO outgoing_drafts(id,document_kind,document_id,recipients_json,subject,body,approved_utc,updated_utc) VALUES(?,?,?,?,?,?,?,?)')
    .run('draft','invoice','inv','[]','Test','Text',stamp,stamp);
  assert.throws(()=>db.exec("UPDATE credit_notes SET reason='hidden edit' WHERE id='credit'"),/immutable/);
  assert.throws(()=>db.exec("DELETE FROM credit_notes WHERE id='credit'"),/immutable/);
  assert.throws(()=>db.exec("UPDATE payment_events SET amount_cents=1 WHERE id='payment'"),/immutable/);
  assert.throws(()=>db.exec("DELETE FROM payment_events WHERE id='payment'"),/immutable/);
  assert.throws(()=>db.exec("UPDATE outgoing_drafts SET subject='changed' WHERE id='draft'"),/immutable/);
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('SQLite enforces supplier split and owner approved half-day capacity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-capacity-'));
 try{const store=new LocalStore(path.join(dir,'db.sqlite'),migrations);store.initializeFictionalCompany();
  const db=store.db,project=store.createProject({code:'P-001',customer:'Demo',siteAddress:'Site'});
  db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)')
   .run('source','local','a'.repeat(64),'receipt','images/demo.png',stamp);
  db.prepare('INSERT INTO purchase_lines(id,source_id,description,supplier_quantity_mills,net_unit_cost_cents) VALUES(?,?,?,?,?)')
   .run('line','source','Conduit',1000,500);
  db.prepare('INSERT INTO material_dispositions(id,line_id,quantity_mills,category,project_id,created_utc) VALUES(?,?,?,?,?,?)')
   .run('split1','line',750,'project',project,stamp);
  assert.throws(()=>db.prepare('INSERT INTO material_dispositions(id,line_id,quantity_mills,category,created_utc) VALUES(?,?,?,?,?)')
   .run('split2','line',500,'stock',stamp),/exceed/);
  db.prepare('INSERT INTO overhead_daily(day,estimate_cents,updated_utc) VALUES(?,?,?)').run('2026-11-23',30000,stamp);
  db.prepare('INSERT INTO overhead_project_days(day,project_id,half_days,allocated_cents) VALUES(?,?,?,?)')
   .run('2026-11-23',project,1,15000);
  const second=store.createProject({code:'P-002',customer:'Demo',siteAddress:'Site'});
  db.prepare('INSERT INTO overhead_project_days(day,project_id,half_days,allocated_cents) VALUES(?,?,?,?)')
   .run('2026-11-23',second,1,15000);
  const third=store.createProject({code:'P-003',customer:'Demo',siteAddress:'Site'});
  assert.throws(()=>db.prepare('INSERT INTO overhead_project_days(day,project_id,half_days,allocated_cents) VALUES(?,?,?,?)')
   .run('2026-11-23',third,1,15000),/exceeds/);
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('purchase-line quantity cannot be reduced beneath existing material splits, even through direct SQL',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-parent-capacity-'));
 try{const store=new LocalStore(path.join(dir,'db.sqlite'),migrations);try{
  store.initializeFictionalCompany();const db=store.db,project=store.createProject({code:'CAP',customer:'Synthetic',siteAddress:'Site'});
  db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)').run('source','local','a'.repeat(64),'receipt','images/demo.png',stamp);
  db.prepare('INSERT INTO purchase_lines(id,source_id,description,supplier_quantity_mills,net_unit_cost_cents) VALUES(?,?,?,?,?)').run('line','source','Conduit',1000,500);
  db.prepare('INSERT INTO material_dispositions(id,line_id,quantity_mills,category,project_id,created_utc) VALUES(?,?,?,?,?,?)').run('split','line',750,'project',project,stamp);
  assert.throws(()=>db.exec("UPDATE purchase_lines SET supplier_quantity_mills=749 WHERE id='line'"),/exceed supplier quantity/);
  assert.equal(db.prepare("SELECT supplier_quantity_mills FROM purchase_lines WHERE id='line'").get()?.supplier_quantity_mills,1000);
  db.exec("UPDATE purchase_lines SET supplier_quantity_mills=750 WHERE id='line'");
  assert.throws(()=>db.exec("UPDATE material_dispositions SET quantity_mills=751 WHERE id='split'"),/exceed supplier quantity/);
  assert.equal(db.prepare("SELECT quantity_mills FROM material_dispositions WHERE id='split'").get()?.quantity_mills,750);
  db.exec("UPDATE purchase_lines SET supplier_quantity_mills=1000 WHERE id='line'");
  db.prepare('INSERT INTO material_dispositions(id,line_id,quantity_mills,category,created_utc) VALUES(?,?,?,?,?)').run('stock','line',250,'stock',stamp);
  assert.equal(db.prepare("SELECT SUM(quantity_mills) AS n FROM material_dispositions WHERE line_id='line'").get()?.n,1000);
 }finally{store.close();}}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('material split capacity remains exact at the signed SQLite INTEGER boundary',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-capacity-max-'));
 try{const store=new LocalStore(path.join(dir,'db.sqlite'),migrations);try{
  store.initializeFictionalCompany();const db=store.db,max=2n**63n-1n;
  db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)').run('source','local','a'.repeat(64),'receipt','images/demo.png',stamp);
  db.prepare('INSERT INTO purchase_lines(id,source_id,description,supplier_quantity_mills,net_unit_cost_cents) VALUES(?,?,?,?,?)').run('line','source','Synthetic cable',max,1);
  const add=db.prepare('INSERT INTO material_dispositions(id,line_id,quantity_mills,category,created_utc) VALUES(?,?,?,?,?)');
  add.run('split','line',max-1n,'stock',stamp);add.run('last','line',1,'stock',stamp);
  assert.throws(()=>add.run('overflow','line',1,'stock',stamp),/exceed supplier quantity/);
  assert.throws(()=>db.exec("UPDATE material_dispositions SET quantity_mills=2 WHERE id='last'"),/exceed supplier quantity/);
  assert.throws(()=>db.prepare("UPDATE purchase_lines SET supplier_quantity_mills=? WHERE id='line'").run(max-1n),/exceed supplier quantity/);
  const read=db.prepare("SELECT SUM(quantity_mills) AS n,typeof(SUM(quantity_mills)) AS storage FROM material_dispositions WHERE line_id='line'");read.setReadBigInts(true);
  assert.equal(read.get()?.n,max);assert.equal(read.get()?.storage,'integer');
 }finally{store.close();}}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
