import {test} from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
test('drafts are editable while issued invoices and payment receipts reject updates/deletes',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tm-invoice-immut-'));
 try{const s=new LocalStore(path.join(tmp,'db.sqlite'));s.initializeFictionalCompany();
  const p=s.createProject({code:'SYN-IMM',customer:'Fictional',siteAddress:'100 Example St'});
  s.db.prepare('INSERT INTO invoice_drafts (id,project_id,body_json,updated_utc) VALUES (?,?,?,?)').run('draft',p,'{}','2026-11-23');
  s.db.prepare('UPDATE invoice_drafts SET body_json=? WHERE id=?').run('{"foo":2}','draft');
  s.db.prepare(`INSERT INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)`).run('invoice',p,'INV-001','{}','2026-11-23',10000,'fake-sha','artifact/path.pdf');
  assert.throws(()=>s.db.prepare('UPDATE issued_invoices SET amount_cents=1 WHERE id=?').run('invoice'),/immutable/);
  assert.throws(()=>s.db.prepare('DELETE FROM issued_invoices WHERE id=?').run('invoice'),/immutable/);
  s.db.prepare('INSERT INTO payment_events VALUES (?,?,?,?,?,?,?)').run('pay','invoice',5000,'2026-11-23','cash','synthetic','2026-11-23');
  s.db.prepare('INSERT INTO payment_receipts VALUES (?,?,?,?,?,?)').run('rcpt','pay','{}',null,null,'2026-11-23');
  assert.throws(()=>s.db.prepare('UPDATE payment_receipts SET immutable_body_json=? WHERE id=?').run('{}','rcpt'),/immutable/);
  s.close();
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('SQL REPLACE cannot bypass issued invoice delete triggers',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tm-invoice-replace-'));
 try{
  const s=new LocalStore(path.join(tmp,'db.sqlite'));s.initializeFictionalCompany();
  try{
   const p=s.createProject({code:'SYN-REPLACE',customer:'Fictional',siteAddress:'Test'});
   s.db.prepare('INSERT INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)').run('inv',p,'INV-001','{}','2026-11-23',10000,'fake-sha','issued/original.pdf');
   const original=s.db.prepare('SELECT * FROM issued_invoices').all();
   for(const id of ['inv','different-id']){
    assert.throws(()=>s.db.prepare('INSERT OR REPLACE INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)').run(id,p,'INV-001','{}','2026-11-23',1,'other-sha','issued/other.pdf'),/immutable/);
    assert.deepEqual(s.db.prepare('SELECT * FROM issued_invoices').all(),original);
   }
  }finally{s.close();}
 }finally{fs.rmSync(tmp,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('issued ledger row and actual content-addressed PDF remain identical across denied and approved export attempts',async()=>{
 const {makeSyntheticInvoicePdf,saveSyntheticInvoicePdf,capturePdfExportTarget}=await import('../../packages/pdf/src/invoices/render-invoice');
 const {storeImmutablePdf}=await import('../../packages/pdf/src/common/stored-pdf');
 const {createHash}=await import('node:crypto');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-issued-combined-')),profile=path.join(dir,'profile'),artifacts=path.join(profile,'local-data','artifacts'),dbPath=path.join(profile,'local-data','db','app.sqlite');
 const fixture={company:'Synthetic Electric',customer:'Synthetic',project:'Test',invoiceNumber:'SYN-001',taxId:'FAKE',contractorLicense:'FAKE',amount:'100.00'};
 let store:LocalStore|undefined;
 try{
  store=new LocalStore(dbPath);store.initializeFictionalCompany();const project=store.createProject({code:'IMMUTABLE-COMBINED',customer:'Synthetic',siteAddress:'Test'});
  const bytes=makeSyntheticInvoicePdf(fixture),issued=await storeImmutablePdf(artifacts,bytes),original=path.join(artifacts,issued.relativePath);
  const hash=()=>createHash('sha256').update(fs.readFileSync(original)).digest('hex');
  store.db.prepare('INSERT INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)').run('issued',project,'SYN-001','{"synthetic":true}','2026-11-23',10000,issued.sha256,issued.relativePath);
  const before=store.db.prepare('SELECT * FROM issued_invoices').all();const preserved=()=>{assert.deepEqual(store!.db.prepare('SELECT * FROM issued_invoices').all(),before);assert.equal(hash(),issued.sha256);assert.deepEqual(fs.readFileSync(original),bytes);};
  const alias=path.join(dir,'alias');fs.symlinkSync(profile,alias,process.platform==='win32'?'junction':'dir');
  const hardlink=path.join(dir,'linked.pdf');fs.linkSync(original,hardlink);
  for(const target of [original,path.join(alias,'local-data','artifacts',issued.relativePath),hardlink]){
   await assert.rejects(capturePdfExportTarget(target,[profile]),/managed application data|Unsafe PDF destination/);
   await assert.rejects(saveSyntheticInvoicePdf(target,{...fixture,amount:'99.00'},{protectedRoots:[profile],allowReplace:true}),/managed application data|Unsafe PDF destination/);preserved();
  }
  fs.unlinkSync(hardlink);
  for(const sql of ["UPDATE issued_invoices SET amount_cents=1 WHERE id='issued'","DELETE FROM issued_invoices WHERE id='issued'"]){assert.throws(()=>store!.db.exec(sql),/immutable/);preserved();}
  for(const id of ['issued','different-id']){assert.throws(()=>store!.db.prepare('INSERT OR REPLACE INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)').run(id,project,'SYN-001','{}','2026-11-23',1,'b'.repeat(64),'issued/other.pdf'),/immutable/);preserved();}
  const exported=path.join(dir,'external.pdf');await saveSyntheticInvoicePdf(exported,fixture,{protectedRoots:[profile]});assert.deepEqual(fs.readFileSync(exported),bytes);preserved();
  const expectedExisting=await capturePdfExportTarget(exported,[profile]);await saveSyntheticInvoicePdf(exported,{...fixture,amount:'99.00'},{protectedRoots:[profile],allowReplace:true,expectedExisting});assert.notDeepEqual(fs.readFileSync(exported),bytes);preserved();
  store.close();store=new LocalStore(dbPath);preserved();
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
