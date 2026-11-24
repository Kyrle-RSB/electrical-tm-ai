import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
import {createBackup} from '../../packages/backup/src/create-backup';
import {verifyBackup,restoreBackup} from '../../packages/backup/src/restore-backup';
const migrations='packages/persistence-sqlite/src/migrations';
test('backup verifies matching schema, restores records and retains original rescue',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-'));
 const live=path.join(root,'live'),backupRoot=path.join(root,'external');
 try{
  const file=path.join(live,'db','app.sqlite');let db=new LocalStore(file,migrations);db.initializeFictionalCompany();
  db.createProject({code:'ORIGINAL',customer:'Demo',siteAddress:'Site 1'});
  const saved=await createBackup(db,live,backupRoot);
  await verifyBackup(saved.backupPath,migrations);
  db.createProject({code:'LATER',customer:'Demo',siteAddress:'Site 2'});db.close();
  const result=await restoreBackup(saved.backupPath,live,migrations);
  assert.ok(result.rollbackPath&&fs.existsSync(result.rollbackPath));
  db=new LocalStore(file,migrations);assert.deepEqual(db.listProjects().map(x=>x.project_code),['ORIGINAL']);db.close();
  const prior=new LocalStore(path.join(result.rollbackPath!,'db','app.sqlite'),migrations);
  assert.deepEqual(prior.listProjects().map(x=>x.project_code),['LATER','ORIGINAL']);prior.close();
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
test('incompatible migration history is rejected even when attacker fixes manifest hashes',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-incompatible-'));
 const live=path.join(root,'live'),backupRoot=path.join(root,'external');
 try{
  const db=new LocalStore(path.join(live,'db','app.sqlite'),migrations);db.initializeFictionalCompany();
  const saved=await createBackup(db,live,backupRoot);db.close();
  const archived=path.join(saved.backupPath,'db','app.sqlite');
  const modified=new DatabaseSync(archived);
  modified.prepare('UPDATE schema_migrations SET checksum=? WHERE version=1').run('0'.repeat(64));modified.close();
  const manifestPath=path.join(saved.backupPath,'manifest.json'),m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const raw=fs.readFileSync(archived);m.files.find((f:any)=>f.path==='db/app.sqlite').sha256=crypto.createHash('sha256').update(raw).digest('hex');
  m.files.find((f:any)=>f.path==='db/app.sqlite').bytes=raw.length;
  fs.writeFileSync(manifestPath,JSON.stringify(m));
  await assert.rejects(verifyBackup(saved.backupPath,migrations),/Migration history mismatch/);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('complete synthetic foundation chain survives backup/restore with PDF and image (MOCK vault only)',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-native-proof-primitives-'));
 const working=path.join(root,'app-data'),dest=path.join(root,'backups');
 const {importImageFromPickedFile}=await import('../../packages/asset-vault/src/import-file');
 const {verifyManagedImage}=await import('../../packages/asset-vault/src/verify-image');
 const {saveSyntheticInvoicePdf}=await import('../../packages/pdf/src/invoices/render-invoice');
 const {ProtectedSecretFile}=await import('../../apps/desktop/src/main/os/keychain');
 try{
   let db=new LocalStore(path.join(working,'db','app.sqlite'),migrations);
   db.initializeFictionalCompany();
   const projectId=db.createProject({code:'SMOKE-001',customer:'Synthetic Check',siteAddress:'1 Test Road'});
   const photo=path.join(root,'synthetic.png');
   fs.writeFileSync(photo,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64'));
   const imported=await importImageFromPickedFile(photo,path.join(working,'vault'));
   const checked=await verifyManagedImage(path.join(working,'vault'),imported.relativePath,imported.sha256);
   assert.equal(checked.mime,'image/png');
   const invoice={company:'Synthetic Demo',customer:'Synthetic Check',project:'SMOKE-001',invoiceNumber:'SMOKE-0001',taxId:'FAKE-TAX-ID',contractorLicense:'FAKE-LICENSE',amount:'125.00'};
   const pdf=path.join(working,'artifacts','smoke-invoice.pdf');
   await saveSyntheticInvoicePdf(pdf,invoice);
   const original=fs.readFileSync(pdf);
   await assert.rejects(()=>saveSyntheticInvoicePdf(pdf,invoice),/already exists/);
   await saveSyntheticInvoicePdf(pdf,invoice,{allowReplace:true});
   assert.deepEqual(fs.readFileSync(pdf),original);
   // Only a MOCK provider here. Real OS vault testing remains a separate native gate.
   const secret=new ProtectedSecretFile({isAsyncEncryptionAvailable:async()=>true,
     encryptStringAsync:async(s)=>Buffer.from('MOCK:'+Buffer.from(s).toString('base64')),
     decryptStringAsync:async(b)=>({result:Buffer.from(b.toString().slice(5),'base64').toString('utf8'),shouldReEncrypt:false})},
      path.join(root,'mock-secrets','fake.bin'));
   await secret.storeFakeToken('TEST-FAKE-EXAMPLE');
   assert.equal(await secret.readFakeToken(),'TEST-FAKE-EXAMPLE');
   await secret.remove();assert.equal(await secret.exists(),false);
   const saved=await createBackup(db,working,dest);
   const manifest=await verifyBackup(saved.backupPath,migrations);
   assert.deepEqual(manifest.files.map(x=>x.path).sort(),
     ['db/app.sqlite','artifacts/smoke-invoice.pdf',`vault/${imported.relativePath}`].sort());
   db.createProject({code:'LATER',customer:'Synthetic',siteAddress:'2 Test Road'});
   db.close();
   await restoreBackup(saved.backupPath,working,migrations);
   db=new LocalStore(path.join(working,'db','app.sqlite'),migrations);
   assert.deepEqual(db.listProjects().map(x=>x.id),[projectId]);
   assert.deepEqual(fs.readFileSync(pdf),original);
   assert.equal((await verifyManagedImage(path.join(working,'vault'),imported.relativePath,imported.sha256)).mime,'image/png');
   db.close();
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
