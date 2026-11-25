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
   fs.writeFileSync(photo,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAIklEQVR4nGP8//8/AzUAE1VMGTVo1KBRg0YNGjVo1CCKAAAZ0QMtxqFhfwAAAABJRU5ErkJggg==','base64'));
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

test('backup and restore reject directory aliases overlapping live application data',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-alias-'));
 const live=path.join(root,'live'),alias=path.join(root,'alias');
 try{
  const db=new LocalStore(path.join(live,'db','app.sqlite'),migrations);
  try{
   db.initializeFictionalCompany();
   fs.symlinkSync(live,alias,process.platform==='win32'?'junction':'dir');
   const nested=path.join(alias,'nested');
   await assert.rejects(createBackup(db,live,nested),/outside data directory/);
   assert.equal(fs.existsSync(path.join(live,'nested')),false);
   const saved=await createBackup(db,live,path.join(root,'external'));
   const before=fs.readFileSync(path.join(saved.backupPath,'db','app.sqlite'));
   const destinationAlias=path.join(root,'backup-alias');
   fs.symlinkSync(saved.backupPath,destinationAlias,process.platform==='win32'?'junction':'dir');
   await assert.rejects(restoreBackup(saved.backupPath,path.join(destinationAlias,'nested'),migrations),/Cannot restore onto backup/);
   assert.deepEqual(fs.readFileSync(path.join(saved.backupPath,'db','app.sqlite')),before);
   assert.equal(fs.existsSync(path.join(saved.backupPath,'nested')),false);
  }finally{db.close();}
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('backup refuses a managed vault root junction or symlink to unrelated files',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-vault-root-'));
 const live=path.join(root,'live'),external=path.join(root,'outside'),destination=path.join(root,'backups');
 try{
  const db=new LocalStore(path.join(live,'db','app.sqlite'),migrations);
  try{
   db.initializeFictionalCompany();const id=db.createProject({code:'SAFE-ROOT',customer:'Synthetic',siteAddress:'1 Test Road'});
   fs.mkdirSync(external);const canary=path.join(external,'synthetic-private.txt');fs.writeFileSync(canary,'SYNTHETIC CANARY');
   fs.symlinkSync(external,path.join(live,'vault'),process.platform==='win32'?'junction':'dir');
   await assert.rejects(createBackup(db,live,destination),/Unsupported filesystem object/);
   assert.deepEqual(db.listProjects().map(p=>p.id),[id]);
   assert.equal(fs.readFileSync(canary,'utf8'),'SYNTHETIC CANARY');
   assert.equal(fs.existsSync(destination)?fs.readdirSync(destination).length:0,0);
  }finally{db.close();}
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

// P2-AC12/14: a manifest may be internally consistent while omitting DB-owned evidence.
test('backup refuses missing DB-referenced receipt and issued PDF; restore rejects a rehashed incomplete archive',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-reference-integrity-'));
 const live=path.join(root,'live'),dest=path.join(root,'backups');
 const hash=(b:Buffer)=>crypto.createHash('sha256').update(b).digest('hex');
 const receipt=Buffer.from('synthetic receipt evidence');const pdf=Buffer.from('%PDF-1.4\nsynthetic issued evidence');
 const locator='images/synthetic-receipt.png',pdfLocator='issued/synthetic.pdf';
 const stamp='2026-11-24T00:00:00Z';
 let db:LocalStore|undefined;
 try{
  db=new LocalStore(path.join(live,'db','app.sqlite'),migrations);db.initializeFictionalCompany();
  const project=db.createProject({code:'REFERENCES',customer:'Synthetic',siteAddress:'Site'});
  db.db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)').run('synthetic-source','local',hash(receipt),'receipt',locator,stamp);
  db.db.prepare('INSERT INTO issued_invoices(id,project_id,invoice_number,immutable_body_json,issued_utc,amount_cents,pdf_sha256,pdf_locator) VALUES(?,?,?,?,?,?,?,?)').run('synthetic-invoice',project,'REF-01','{}',stamp,100,hash(pdf),pdfLocator);
  await assert.rejects(createBackup(db,live,dest),/Referenced backup evidence missing or altered/);
  fs.mkdirSync(path.join(live,'vault','images'),{recursive:true});fs.writeFileSync(path.join(live,'vault',locator),receipt);
  fs.mkdirSync(path.join(live,'artifacts','issued'),{recursive:true});fs.writeFileSync(path.join(live,'artifacts',pdfLocator),pdf);
  const saved=await createBackup(db,live,dest);await verifyBackup(saved.backupPath,migrations);
  const relative='artifacts/'+pdfLocator;
  fs.rmSync(path.join(saved.backupPath,relative));
  const manifestFile=path.join(saved.backupPath,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  manifest.files=manifest.files.filter((entry:{path:string})=>entry.path!==relative);
  fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  db.close();db=undefined;
  const before=fs.readFileSync(path.join(live,'db','app.sqlite'));
  await assert.rejects(restoreBackup(saved.backupPath,live,migrations),/Referenced backup evidence missing or altered/);
  assert.deepEqual(fs.readFileSync(path.join(live,'db','app.sqlite')),before);
  assert.deepEqual(fs.readFileSync(path.join(live,'artifacts',pdfLocator)),pdf);
 }finally{db?.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('restore refuses redirected source or active data root before moving any directory',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-root-'));
 try{
  const live=path.join(root,'live'),file=path.join(live,'db','app.sqlite');
  const db=new LocalStore(file,migrations);db.initializeFictionalCompany();db.createProject({code:'KEPT',customer:'Synthetic',siteAddress:'Site'});
  const saved=await createBackup(db,live,path.join(root,'external'));db.close();
  const sourceAlias=path.join(root,'source-alias'),liveAlias=path.join(root,'active-alias');
  fs.symlinkSync(saved.backupPath,sourceAlias,process.platform==='win32'?'junction':'dir');
  fs.symlinkSync(live,liveAlias,process.platform==='win32'?'junction':'dir');
  const before=fs.readFileSync(file);
  await assert.rejects(restoreBackup(sourceAlias,live,migrations),/Unsupported filesystem object/);
  await assert.rejects(restoreBackup(saved.backupPath,liveAlias,migrations),/Unsupported filesystem object/);
  assert.deepEqual(fs.readFileSync(file),before);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('native backup route cancels safely and recovers original store when restored database cannot rebind',async()=>{
 const {registerBackupHandlers}=await import('../../apps/desktop/src/main/ipc/handlers/backups');
 const {createNativeFileDialogs}=await import('../../apps/desktop/src/main/os/file-dialogs');
 const {BackupDestinationPreference}=await import('../../packages/backup/src/backup-destination');
 const {CHANNELS}=await import('../../packages/contracts/src');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-handler-')),live=path.join(root,'profile','data'),dbPath=path.join(live,'db','app.sqlite');
 let db:LocalStore|undefined;
 try{
  db=new LocalStore(dbPath,migrations);db.initializeFictionalCompany();db.createProject({code:'EARLIER',customer:'Synthetic',siteAddress:'Site'});
  const saved=await createBackup(db,live,path.join(root,'external'));db.createProject({code:'LATEST',customer:'Synthetic',siteAddress:'Site'});
  let selected:string|null=null,consent=false,attempts=0,fatal=false;
  const dialogs=createNativeFileDialogs({open:async()=>({canceled:selected===null,filePaths:selected===null?[]:[selected]}),save:async()=>({canceled:true}),confirm:async()=>({response:consent?1:0})});
  assert.equal(await dialogs.choosePdf(),null);assert.equal(await dialogs.pickReceipt(),null);
  const pref=new BackupDestinationPreference(path.join(root,'profile','settings','backup.json'),path.join(root,'profile'));
  await assert.rejects(pref.set(path.join(root,'profile')),/separate/);
  const handlers=new Map<string,()=>Promise<unknown>>();
  registerBackupHandlers((channel,validate,operation)=>{handlers.set(channel,async()=>operation('synthetic',validate(undefined)));},{dialogs,preference:pref,dataRoot:live,migrationsDir:migrations,getStore:()=>db!,setStore:value=>{db=value;},reopen:()=>{attempts++;if(attempts===1)throw new Error('Synthetic rebind failure');return new LocalStore(dbPath,migrations);},onFatalRecovery:()=>{fatal=true;}});
  const restore=handlers.get(CHANNELS.backupRestore)!;
  assert.equal(await restore(),null);assert.equal(attempts,0);
  selected=saved.backupPath;assert.equal(await restore(),null);assert.equal(attempts,0);
  consent=true;await assert.rejects(restore(),/Synthetic rebind failure/);
  assert.equal(fatal,false);assert.equal(attempts,2);assert.deepEqual(db.listProjects().map(p=>p.project_code),['EARLIER','LATEST']);
 }finally{try{db?.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('optional managed business logo survives backup, removal and restore; omission is rejected',async()=>{
 const {createBusinessBrandingUseCases}=await import('../../packages/application/src/use-cases/business-branding');
 const {importImageFromPickedFile}=await import('../../packages/asset-vault/src/import-file');
 const {randomUUID}=await import('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-logo-')),live=path.join(root,'live'),dbPath=path.join(live,'db','app.sqlite');
 let db:LocalStore|undefined;
 try{
  db=new LocalStore(dbPath,migrations);db.initializeFictionalCompany();
  assert.equal(db.getBusinessLogo(),null);
  const image=path.join(root,'synthetic.png');fs.writeFileSync(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAIklEQVR4nGP8//8/AzUAE1VMGTVo1KBRg0YNGjVo1CCKAAAZ0QMtxqFhfwAAAABJRU5ErkJggg==','base64'));
  const receipt=await importImageFromPickedFile(image,path.join(live,'vault'));
  db.db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)').run('logo-test-receipt','local',receipt.sha256,'receipt',receipt.relativePath,'2026-11-24T00:00:00Z');
  const logo=await importImageFromPickedFile(image,path.join(live,'vault'));assert.notEqual(logo.id,receipt.id);
  const use=createBusinessBrandingUseCases(db,async()=>logo),operation=randomUUID();
  assert.equal((await use.choose(operation))?.id,logo.id);
  await assert.rejects(use.choose(operation),/duplicate mutation/);
  const cancel=createBusinessBrandingUseCases(db,async()=>null);assert.equal(await cancel.choose(randomUUID()),null);assert.equal(db.getBusinessLogo()?.id,logo.id);
  assert.throws(()=>db!.setBusinessLogo({...logo,relativePath:'../../outside.png'}),/Invalid managed logo/);
  const saved=await createBackup(db,live,path.join(root,'backups'));assert.ok(saved.manifest.files.some(f=>f.path==='vault/'+logo.relativePath&&f.sha256===logo.sha256));
  await verifyBackup(saved.backupPath,migrations);
  use.remove(randomUUID());assert.equal(db.getBusinessLogo(),null);assert.ok(fs.existsSync(path.join(live,'vault',logo.relativePath)));
  db.close();db=undefined;
  await restoreBackup(saved.backupPath,live,migrations);db=new LocalStore(dbPath,migrations);assert.equal(db.getBusinessLogo()?.id,logo.id);
  const logoRelative='vault/'+logo.relativePath;fs.rmSync(path.join(saved.backupPath,logoRelative));const manifestFile=path.join(saved.backupPath,'manifest.json');const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));manifest.files=manifest.files.filter((f:{path:string})=>f.path!==logoRelative);fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  await assert.rejects(verifyBackup(saved.backupPath,migrations),/Referenced backup evidence missing or altered/);
 }finally{db?.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('backup and restore refuse hardlinked external evidence and manifests without modifying unrelated data',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-link-evidence-')),live=path.join(root,'live'),dest=path.join(root,'external');
 const db=new LocalStore(path.join(live,'db','app.sqlite'),migrations);
 try{
  db.initializeFictionalCompany();const unrelated=path.join(root,'unrelated.bin');fs.writeFileSync(unrelated,'SYNTHETIC UNRELATED');
  const folder=path.join(live,'vault','images');fs.mkdirSync(folder,{recursive:true});const linked=path.join(folder,'linked.png');fs.linkSync(unrelated,linked);
  await assert.rejects(createBackup(db,live,dest),/regular|Unsafe|linked|changed/i);
  fs.unlinkSync(linked);const saved=await createBackup(db,live,dest);
  const mf=path.join(saved.backupPath,'manifest.json'),outside=path.join(root,'external-manifest.json');fs.copyFileSync(mf,outside);fs.unlinkSync(mf);fs.linkSync(outside,mf);
  await assert.rejects(verifyBackup(saved.backupPath,migrations),/regular|Unsafe|linked|changed/i);
  assert.equal(fs.readFileSync(unrelated,'utf8'),'SYNTHETIC UNRELATED');
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});


test('restore confirmation is bound to the originally verified archive even if a different valid backup replaces it',async()=>{
 const {registerBackupHandlers}=await import('../../apps/desktop/src/main/ipc/handlers/backups');
 const {BackupDestinationPreference}=await import('../../packages/backup/src/backup-destination');
 const {CHANNELS}=await import('../../packages/contracts/src');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-consent-')),live=path.join(root,'profile','data'),dbPath=path.join(live,'db','app.sqlite');
 let db:LocalStore|undefined;
 try{
  db=new LocalStore(dbPath,migrations);db.initializeFictionalCompany();db.createProject({code:'FIRST',customer:'Synthetic',siteAddress:'Site'});
  const first=await createBackup(db,live,path.join(root,'first'));
  db.createProject({code:'SECOND',customer:'Synthetic',siteAddress:'Site'});
  const second=await createBackup(db,live,path.join(root,'second'));
  db.createProject({code:'LATEST',customer:'Synthetic',siteAddress:'Site'});
  let swapped=false,fatal=false;
  const pref=new BackupDestinationPreference(path.join(root,'profile','settings','backup.json'),path.join(root,'profile'));
  const handlers=new Map<string,()=>Promise<unknown>>();
  registerBackupHandlers((channel,validate,operation)=>{handlers.set(channel,async()=>operation('synthetic',validate(undefined)));},{
   dialogs:{chooseFolder:async()=>first.backupPath,confirmRestore:async()=>{fs.renameSync(first.backupPath,first.backupPath+'-retained');fs.renameSync(second.backupPath,first.backupPath);swapped=true;return true;}},
   preference:pref,dataRoot:live,migrationsDir:migrations,getStore:()=>db!,setStore:value=>{db=value;},reopen:()=>new LocalStore(dbPath,migrations),onFatalRecovery:()=>{fatal=true;}
  });
  let failure:unknown;try{await handlers.get(CHANNELS.backupRestore)!();}catch(error){failure=error;}
  assert.equal(swapped,true);assert.ok(failure instanceof Error,'different valid archive must be rejected');assert.match(failure.message,/changed after verification/);
  assert.equal(fatal,false);assert.deepEqual(db.listProjects().map(p=>p.project_code),['FIRST','LATEST','SECOND']);
  assert.deepEqual(fs.readdirSync(path.dirname(live)),['data']);
 }finally{try{db?.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('double rename failure preserves verified stage and original rescue, disables rebind and blocks fresh startup',async()=>{
 const {registerBackupHandlers}=await import('../../apps/desktop/src/main/ipc/handlers/backups');
 const {BackupDestinationPreference,canonicalBackupPath}=await import('../../packages/backup/src/backup-destination');
 const {prepareApplicationPaths}=await import('../../apps/desktop/src/main/os/paths');
 const {CHANNELS}=await import('../../packages/contracts/src');
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-double-fail-'))),profile=path.join(root,'profile'),live=path.join(profile,'local-data'),dbPath=path.join(live,'db','app.sqlite');
 const rename=fs.promises.rename;let db:LocalStore|undefined;
 try{
  db=new LocalStore(dbPath,migrations);db.initializeFictionalCompany();db.createProject({code:'EARLIER',customer:'Synthetic',siteAddress:'Site'});
  const saved=await createBackup(db,live,path.join(root,'external'));db.createProject({code:'LATEST',customer:'Synthetic',siteAddress:'Site'});
  let fatal=false,reopens=0,failures=0,rescue='',stage='';
  const pref=new BackupDestinationPreference(path.join(profile,'settings','backup.json'),profile);
  const handlers=new Map<string,()=>Promise<unknown>>();
  registerBackupHandlers((channel,validate,operation)=>{handlers.set(channel,async()=>operation('synthetic',validate(undefined)));},{
   dialogs:{chooseFolder:async()=>saved.backupPath,confirmRestore:async()=>true},preference:pref,dataRoot:live,migrationsDir:migrations,getStore:()=>db!,setStore:v=>{db=v;},reopen:()=>{reopens++;return new LocalStore(dbPath,migrations);},onFatalRecovery:()=>{fatal=true;}
  });
  // Match the same physical path spelling as restoreBackup, including Windows realpath normalization.
  const target=await canonicalBackupPath(live);
  fs.promises.rename=(async(from,to)=>{
   if(String(from)===target&&path.basename(String(to)).startsWith('.tm-rollback-'))rescue=String(to);
   if(String(to)===target&&path.basename(String(from)).startsWith('.tm-restore-')){stage=String(from);failures++;throw Object.assign(new Error('Synthetic activation failure'),{code:'EIO'});}
   if(String(to)===target&&path.basename(String(from)).startsWith('.tm-rollback-')){failures++;throw Object.assign(new Error('Synthetic rollback failure'),{code:'EIO'});}
   return rename(from,to);
  }) as typeof rename;
  await assert.rejects(handlers.get(CHANNELS.backupRestore)!());
  assert.equal(failures,2);assert.equal(fatal,true,'missing active database must never reopen as a new business');assert.equal(reopens,0);assert.equal(fs.existsSync(live),false);
  assert.ok(rescue&&stage);assert.ok(fs.existsSync(path.join(stage,'db','app.sqlite')));assert.ok(fs.existsSync(path.join(rescue,'db','app.sqlite')));
  const original=new LocalStore(path.join(rescue,'db','app.sqlite'),migrations);try{assert.deepEqual(original.listProjects().map(p=>p.project_code),['EARLIER','LATEST']);}finally{original.close();}
  assert.throws(()=>prepareApplicationPaths(profile,root,root,true),/Restore recovery requires operator intervention/);assert.equal(fs.existsSync(live),false);
  // Recovery of a disposable fixture only: an operator deliberately selects the original rescue.
  fs.promises.rename=rename;await rename(rescue,live);
  assert.equal(prepareApplicationPaths(profile,root,root,true).database,dbPath);
  db=new LocalStore(dbPath,migrations);assert.deepEqual(db.listProjects().map(p=>p.project_code),['EARLIER','LATEST']);
 }finally{fs.promises.rename=rename;try{db?.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('activation failure with successful rollback reopens only the original business and retains its bytes',async()=>{
 const {registerBackupHandlers}=await import('../../apps/desktop/src/main/ipc/handlers/backups');
 const {BackupDestinationPreference,canonicalBackupPath}=await import('../../packages/backup/src/backup-destination');
 const {CHANNELS}=await import('../../packages/contracts/src');
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-activation-fail-'))),profile=path.join(root,'profile'),live=path.join(profile,'local-data'),dbPath=path.join(live,'db','app.sqlite');
 const rename=fs.promises.rename;let db:LocalStore|undefined;
 try{
  db=new LocalStore(dbPath,migrations);db.initializeFictionalCompany();db.createProject({code:'FIRST',customer:'Synthetic',siteAddress:'Site'});
  const saved=await createBackup(db,live,path.join(root,'external'));db.createProject({code:'LATEST',customer:'Synthetic',siteAddress:'Site'});
  fs.mkdirSync(path.join(live,'artifacts'));fs.writeFileSync(path.join(live,'artifacts','retained.txt'),'ORIGINAL CURRENT BYTES');
  let fatal=false,reopens=0,failures=0;
  const pref=new BackupDestinationPreference(path.join(profile,'settings','backup.json'),profile),handlers=new Map<string,()=>Promise<unknown>>();
  registerBackupHandlers((channel,validate,operation)=>{handlers.set(channel,async()=>operation('synthetic',validate(undefined)));},{dialogs:{chooseFolder:async()=>saved.backupPath,confirmRestore:async()=>true},preference:pref,dataRoot:live,migrationsDir:migrations,getStore:()=>db!,setStore:v=>{db=v;},reopen:()=>{reopens++;return new LocalStore(dbPath,migrations);},onFatalRecovery:()=>{fatal=true;}});
  // Match the same physical path spelling as restoreBackup, including Windows realpath normalization.
  const target=await canonicalBackupPath(live);
  fs.promises.rename=(async(from,to)=>{if(String(to)===target&&path.basename(String(from)).startsWith('.tm-restore-')){failures++;throw Object.assign(new Error('Synthetic activation failure'),{code:'EIO'});}return rename(from,to);}) as typeof rename;
  await assert.rejects(handlers.get(CHANNELS.backupRestore)!(),/Synthetic activation failure/);
  assert.equal(failures,1);assert.equal(fatal,false);assert.equal(reopens,1);assert.deepEqual(db.listProjects().map(p=>p.project_code),['FIRST','LATEST']);assert.equal(fs.readFileSync(path.join(live,'artifacts','retained.txt'),'utf8'),'ORIGINAL CURRENT BYTES');
  assert.deepEqual(fs.readdirSync(profile),['local-data']);
 }finally{fs.promises.rename=rename;try{db?.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('actual restore handler rejects tampered image, issued PDF, database, missing references and unsupported schema before consent or live mutation',async()=>{
 const {registerBackupHandlers}=await import('../../apps/desktop/src/main/ipc/handlers/backups');
 const {BackupDestinationPreference}=await import('../../packages/backup/src/backup-destination');
 const {importImageFromPickedFile}=await import('../../packages/asset-vault/src/import-file');
 const {storeImmutablePdf}=await import('../../packages/pdf/src/common/stored-pdf');
 const {saveSyntheticInvoicePdf}=await import('../../packages/pdf/src/invoices/render-invoice');
 const {CHANNELS}=await import('../../packages/contracts/src');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-matrix-')),profile=path.join(root,'profile'),live=path.join(profile,'local-data'),dbPath=path.join(live,'db','app.sqlite');let db:LocalStore|undefined;
 const hash=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 try{
  db=new LocalStore(dbPath,migrations);db.initializeFictionalCompany();const project=db.createProject({code:'BASE',customer:'Synthetic',siteAddress:'Site'});
  const img=path.join(root,'receipt.png');fs.copyFileSync('tests/fixtures/synthetic-receipt.png',img);
  const asset=await importImageFromPickedFile(img,path.join(live,'vault')),logo=await importImageFromPickedFile(img,path.join(live,'vault'));
  db.db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)').run('synthetic-source','local',asset.sha256,'receipt',asset.relativePath,'2026-11-24T00:00:00Z');db.setBusinessLogo(logo);
  const exported=path.join(root,'synthetic.pdf');await saveSyntheticInvoicePdf(exported,{company:'Synthetic',customer:'Synthetic',project:'BASE',invoiceNumber:'SYN-1',taxId:'TEST-TAX',contractorLicense:'TEST-LICENSE',amount:'100.00'});
  const pdf=await storeImmutablePdf(path.join(live,'artifacts'),fs.readFileSync(exported));
  db.db.prepare('INSERT INTO issued_invoices VALUES(?,?,?,?,?,?,?,?)').run('synthetic-invoice',project,'SYN-1','{}','2026-11-24T00:00:00Z',10000,pdf.sha256,pdf.relativePath);
  const saved=await createBackup(db,live,path.join(root,'backups'));db.createProject({code:'LATEST',customer:'Synthetic',siteAddress:'Site'});
  // Checkpoint before taking physical file hashes so the comparison is not a WAL side effect.
  db.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const snapshot=()=>({projects:db!.listProjects(),logo:db!.getBusinessLogo(),issued:db!.db.prepare('SELECT * FROM issued_invoices').all(),db:hash(dbPath),asset:hash(path.join(live,'vault',asset.relativePath)),logoBytes:hash(path.join(live,'vault',logo.relativePath)),pdf:hash(path.join(live,'artifacts',pdf.relativePath))});
  const before=snapshot();let selected='',confirmations=0,reopens=0,fatal=false;
  const pref=new BackupDestinationPreference(path.join(profile,'settings','backup.json'),profile),handlers=new Map<string,()=>Promise<unknown>>();
  registerBackupHandlers((channel,validate,operation)=>{handlers.set(channel,async()=>operation('synthetic',validate(undefined)));},{dialogs:{chooseFolder:async()=>selected,confirmRestore:async()=>{confirmations++;return true;}},preference:pref,dataRoot:live,migrationsDir:migrations,getStore:()=>db!,setStore:v=>{db=v;},reopen:()=>{reopens++;return new LocalStore(dbPath,migrations);},onFatalRecovery:()=>{fatal=true;}});
  for(const mode of ['image','pdf','database','missing-reference','unsupported-schema'] as const){
   selected=path.join(root,'tamper-'+mode);fs.cpSync(saved.backupPath,selected,{recursive:true});
   const mf=path.join(selected,'manifest.json');const manifest=JSON.parse(fs.readFileSync(mf,'utf8')) as {files:Array<{path:string;sha256:string;bytes:number}>};
   const relative=mode==='image'?'vault/'+asset.relativePath:mode==='pdf'?'artifacts/'+pdf.relativePath:mode==='missing-reference'?'vault/'+logo.relativePath:'db/app.sqlite';const file=path.join(selected,relative);
   if(mode==='missing-reference'){fs.rmSync(file);manifest.files=manifest.files.filter(entry=>entry.path!==relative);fs.writeFileSync(mf,JSON.stringify(manifest));}
   else if(mode==='unsupported-schema'){const archive=new DatabaseSync(file);try{archive.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(999,'0'.repeat(64),'2026-11-24T00:00:00Z');}finally{archive.close();}const entry=manifest.files.find(e=>e.path===relative)!;entry.bytes=fs.statSync(file).size;entry.sha256=hash(file);fs.writeFileSync(mf,JSON.stringify(manifest));}
   else{const bytes=fs.readFileSync(file);bytes[Math.floor(bytes.length/2)]^=1;fs.writeFileSync(file,bytes);}
   await assert.rejects(handlers.get(CHANNELS.backupRestore)!(),/integrity failure|Referenced backup evidence missing|Migration history mismatch/i,mode);
   assert.equal(confirmations,0,mode);assert.equal(reopens,0,mode);assert.equal(fatal,false,mode);assert.deepEqual(snapshot(),before,mode);
  }
  // Untouched control archive still restores and excludes the later business row.
  selected=saved.backupPath;const restored=await handlers.get(CHANNELS.backupRestore)!();assert.ok(restored);assert.equal(confirmations,1);assert.equal(reopens,1);assert.deepEqual(db.listProjects().map(p=>p.id),[project]);assert.equal(hash(path.join(live,'artifacts',pdf.relativePath)),before.pdf);
 }finally{try{db?.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
