import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { LocalStore } from '../../packages/persistence-sqlite/src/connection';
import { assertEnvelope,validateProjectInput } from '../../packages/contracts/src/ipc/request-envelope';
import { importImageFromPickedFile,validateImageBytes } from '../../packages/asset-vault/src/import-file';
import { saveSyntheticInvoicePdf,makeSyntheticInvoicePdf } from '../../packages/pdf/src/invoices/render-invoice';
import {createBackup} from '../../packages/backup/src/create-backup';
import {restoreBackup,verifyBackup} from '../../packages/backup/src/restore-backup';
import {ProtectedSecretFile,AsyncProtection} from '../../apps/desktop/src/main/os/keychain';
import {isTrustedSender} from '../../apps/desktop/src/main/ipc/sender-guard';
import {registerFoundationHandlers} from '../../apps/desktop/src/main/ipc/register';
import {CHANNELS} from '../../packages/contracts/src/ipc/channel-map';
const mkTemp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'tm-foundation-'));
const rm=(dir:string)=>fs.rmSync(dir,{recursive:true,force:true});

const RECEIPT_FIXTURE = process.env.TM_PROOF_FIXTURE_PNG || path.join(process.cwd(),'tests','fixtures','synthetic-receipt.png');

test('bounded IPC validates request IDs, payloads and forbids arbitrary fields',()=>{
  assert.doesNotThrow(()=>assertEnvelope({requestId:crypto.randomUUID(),version:1,payload:null}));
  for(const bad of [{requestId:'not-a-uuid',version:1,payload:null},{requestId:crypto.randomUUID(),version:1,payload:null,command:'fs.unlink'},{requestId:crypto.randomUUID(),version:1,payload:'x'.repeat(18000)}])assert.throws(()=>assertEnvelope(bad));
  assert.deepEqual(validateProjectInput({code:'SYN-001',customer:' Fictional Customer ',siteAddress:' 45 Sample Way '}),{code:'SYN-001',customer:'Fictional Customer',siteAddress:'45 Sample Way'});
  assert.throws(()=>validateProjectInput({code:'../hacker',customer:'X',siteAddress:'Y'}));
  assert.throws(()=>validateProjectInput({code:'SYN',customer:'X',siteAddress:'Y',admin:true}));
});

test('SQLite migration, WAL, restart and project readback',()=>{
  const dir=mkTemp();try{
    const dbfile=path.join(dir,'db','app.sqlite');let store=new LocalStore(dbfile);
    store.initializeFictionalCompany();
    const id=store.createProject({code:'SYN-1',customer:'Fictional One',siteAddress:'10 Fable Road'});
    assert.equal(store.listProjects()[0].id,id);
    assert.equal((store.db.prepare('PRAGMA foreign_keys').get() as any).foreign_keys,1);
    assert.equal((store.db.prepare('PRAGMA journal_mode').get() as any).journal_mode,'wal');
    store.close();store=new LocalStore(dbfile);
    assert.equal(store.listProjects().length,1);
    assert.throws(()=>store.createProject({code:'SYN-1',customer:'Duplicated',siteAddress:'10 Fable Road'}));
    assert.equal((store.db.prepare('SELECT COUNT(*) AS n FROM audit_events').get() as any).n,1);
    assert.throws(()=>store.db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),'invalid','NO','C','site','2026-11-23'));
    assert.equal((store.db.prepare('SELECT COUNT(*) AS n FROM projects').get() as any).n,1);
    store.close();
  }finally{rm(dir);}
});

test('SQLite transaction abort releases no partial project or audit event',()=>{
  const dir=mkTemp();try{
    const store=new LocalStore(path.join(dir,'app.sqlite'));store.initializeFictionalCompany();
    store.db.exec('BEGIN IMMEDIATE');
    store.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('test.rollback','x',new Date().toISOString());
    store.db.exec('ROLLBACK');
    assert.equal((store.db.prepare('SELECT COUNT(*) AS n FROM audit_events').get() as any).n,0);store.close();
  }finally{rm(dir);}
});

test('SQLite competing writer is blocked until first transaction completes',()=>{
  const dir=mkTemp();try{
    const loc=path.join(dir,'app.sqlite');const a=new LocalStore(loc),b=new LocalStore(loc);a.initializeFictionalCompany();
    b.db.exec('PRAGMA busy_timeout=1');a.db.exec('BEGIN IMMEDIATE');
    assert.throws(()=>b.db.exec('BEGIN IMMEDIATE'));
    a.db.exec('ROLLBACK');b.db.exec('BEGIN IMMEDIATE');b.db.exec('ROLLBACK');a.close();b.close();
  }finally{rm(dir);}
});

test('image import enforces signatures, bounded sizes, hashes and managed paths',async()=>{
  const dir=mkTemp();try{
    const fixture=RECEIPT_FIXTURE;
    assert.ok(fixture&&fs.existsSync(fixture));
    const r=await importImageFromPickedFile(fixture,path.join(dir,'vault'));
    assert.match(r.relativePath,/^images\/[a-f0-9-]+\.png$/);
    assert.equal(r.mime,'image/png');
    assert.equal(r.sha256,crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'));
    assert.equal(validateImageBytes(fs.readFileSync(fixture)),'image/png');
    const spoof=path.join(dir,'receipt.png');fs.writeFileSync(spoof,'<script>alert(1)</script>');
    await assert.rejects(()=>importImageFromPickedFile(spoof,path.join(dir,'vault')));
    const symlink=path.join(dir,'symlink.png');fs.symlinkSync(fixture,symlink);
    await assert.rejects(()=>importImageFromPickedFile(symlink,path.join(dir,'vault')));
    assert.throws(()=>validateImageBytes(Buffer.alloc(13*1024*1024)));
  }finally{rm(dir);}
});

test('PDF feasibility proof generates real PDF containing tax and contractor license IDs',async()=>{
  const dir=mkTemp();try{
    const params={company:'Synthetic Demo Electric Ltd.',customer:'Example Co',project:'SYN-44',invoiceNumber:'TEST-0044',taxId:'FAKE-CAD-TAX',contractorLicense:'FAKE-BC-FSR',amount:'111.25'};
    const bytes=makeSyntheticInvoicePdf(params);assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4');
    assert.ok(bytes.includes(Buffer.from('FAKE-CAD-TAX')));assert.ok(bytes.includes(Buffer.from('FAKE-BC-FSR')));
    const file=path.join(dir,'invoice.pdf');await saveSyntheticInvoicePdf(file,params);
    assert.ok(fs.statSync(file).size>600);
  }finally{rm(dir);}
});

test('synthetic PDF replacement requires explicit authorization, handles existing file and blocks symlink',async()=>{
 const dir=mkTemp();try{
 const params={company:'Synthetic Demo',customer:'Customer',project:'SYN',invoiceNumber:'TEST-001',taxId:'FAKE',contractorLicense:'FAKE',amount:'100.00'};
 const out=path.join(dir,'invoice.pdf');await saveSyntheticInvoicePdf(out,params);
 const first=fs.readFileSync(out);
 await assert.rejects(()=>saveSyntheticInvoicePdf(out,{...params,amount:'300.00'}),/already exists/);
 assert.deepEqual(fs.readFileSync(out),first);
 await saveSyntheticInvoicePdf(out,{...params,amount:'300.00'},{allowReplace:true});
 assert.ok(fs.readFileSync(out).includes(Buffer.from('300.00')));
 assert.ok(!fs.readdirSync(dir).some(x=>x.includes('.tmp-')));
 const symlink=path.join(dir,'symbolic.pdf');fs.symlinkSync(out,symlink);
 await assert.rejects(()=>saveSyntheticInvoicePdf(symlink,params,{allowReplace:true}),/Unsafe PDF destination/);
 }finally{rm(dir);}
});

test('backups include SQLite+attachments, reject tampering and restore while preserving rescue',async()=>{
  const dir=mkTemp();try{
    const data=path.join(dir,'working'), dest=path.join(dir,'backups');
    const store=new LocalStore(path.join(data,'db','app.sqlite'));store.initializeFictionalCompany();
    store.createProject({code:'SYN-77',customer:'Fictional Client',siteAddress:'17 Fable Dr'});
    const v=path.join(data,'vault','images');fs.mkdirSync(v,{recursive:true});
    fs.copyFileSync(RECEIPT_FIXTURE,path.join(v,'receipt.png'));
    fs.mkdirSync(path.join(data,'artifacts'),{recursive:true});
    await saveSyntheticInvoicePdf(path.join(data,'artifacts','invoice.pdf'),{company:'Example',customer:'Fictional',project:'SYN-77',invoiceNumber:'0001',taxId:'FAKE-ID',contractorLicense:'FAKE-LIC',amount:'88.00'});
    fs.mkdirSync(path.join(data,'secrets'),{recursive:true});fs.writeFileSync(path.join(data,'secrets','excluded.key'),'TEST-FAKE-EXCLUDED');
    const {backupPath,manifest}=await createBackup(store,data,dest);
    assert.deepEqual(manifest.files.map(x=>x.path).sort(),['artifacts/invoice.pdf','db/app.sqlite','vault/images/receipt.png'].sort());
    await verifyBackup(backupPath);
    assert.equal(fs.existsSync(path.join(backupPath,'secrets')),false);
    store.createProject({code:'SYN-99',customer:'Fictional Client',siteAddress:'99 Fiction Lane'});store.close();
    const tampered=path.join(dir,'tampered');fs.cpSync(backupPath,tampered,{recursive:true});
    fs.appendFileSync(path.join(tampered,'vault','images','receipt.png'),'attack');
    await assert.rejects(()=>verifyBackup(tampered));
    await assert.rejects(()=>restoreBackup(tampered,data));
    assert.ok(fs.existsSync(path.join(data,'db','app.sqlite')));
    const restored=await restoreBackup(backupPath,data);
    assert.ok(restored.rollbackPath&&fs.existsSync(restored.rollbackPath));
    const reopened=new LocalStore(path.join(data,'db','app.sqlite'));
    assert.deepEqual(reopened.listProjects().map(x=>x.project_code),['SYN-77']);
    reopened.close();
    assert.ok(fs.existsSync(path.join(data,'vault','images','receipt.png')));
  }finally{rm(dir);}
});

test('backup refuses to target data root or child path',async()=>{
  const dir=mkTemp();try{const store=new LocalStore(path.join(dir,'db','app.sqlite'));store.initializeFictionalCompany();
    await assert.rejects(()=>createBackup(store,dir,path.join(dir,'backup')));
    store.close();
  }finally{rm(dir);}
});

test('vault encryption injection proves no plaintext downgrade, revocation and failure path',async()=>{
  const dir=mkTemp();try{
    let available=true;
    const provider:AsyncProtection={
      isAsyncEncryptionAvailable:async()=>available,
      encryptStringAsync:async(s)=>Buffer.from('ENCRYPTED-CANARY:'+Buffer.from(s).toString('base64')),
      decryptStringAsync:async(b)=>({result:Buffer.from(b.toString().replace('ENCRYPTED-CANARY:',''),'base64').toString(),shouldReEncrypt:false})
    };
    const loc=path.join(dir,'secret.bin'),vault=new ProtectedSecretFile(provider,loc);
    await vault.storeFakeToken('TEST-FAKE-EXAMPLE');
    assert.ok(!fs.readFileSync(loc).toString().includes('TEST-FAKE-EXAMPLE'));
    assert.equal(await vault.readFakeToken(),'TEST-FAKE-EXAMPLE');
    await assert.rejects(()=>vault.storeFakeToken('real-secret-not-allowed'));
    available=false;
    await assert.rejects(()=>vault.readFakeToken());
    await assert.rejects(()=>vault.storeFakeToken('TEST-FAKE-WITHOUT-VAULT'));
    await vault.remove();assert.equal(await vault.exists(),false);
  }finally{rm(dir);}
});

test('renderer impersonation blocked by frame identity and exact URL',()=>{
  const primary={id:5,isDestroyed:()=>false};const url='tmapp://app/index.html';
  const frame:any={url};frame.top=frame;
  assert.equal(isTrustedSender({sender:primary,senderFrame:frame},primary,url),true);
  assert.equal(isTrustedSender({sender:{id:5},senderFrame:frame},primary,url),false);
  assert.equal(isTrustedSender({sender:primary,senderFrame:{url,top:frame}},primary,url),false);
  const attacker:any={url:url+'?spoof=1'};attacker.top=attacker;
  assert.equal(isTrustedSender({sender:primary,senderFrame:attacker},primary,url),false);
  assert.equal(isTrustedSender({sender:primary,senderFrame:null},primary,url),false);
});

test('IPC handler registry only creates project through validated same-frame call',async()=>{
  const dir=mkTemp();try{
    const primary={id:7},url='tmapp://app/index.html',frame:any={url};frame.top=frame;
    const handlers=new Map<string,(event:any,request:any)=>Promise<unknown>>();
    const store=new LocalStore(path.join(dir,'app.sqlite'));store.initializeFictionalCompany();
    registerFoundationHandlers({handle:(ch,h)=>{handlers.set(ch,h);}}, {primary,url,getStore:()=>store});
    assert.deepEqual([...handlers.keys()].sort(),[CHANNELS.ping,CHANNELS.projectAdd,CHANNELS.projectEdit,CHANNELS.projectList,CHANNELS.projectDetailedList,CHANNELS.projectDetails,CHANNELS.projectStatus,CHANNELS.businessGet,CHANNELS.businessUpdate].sort());
    const event={sender:primary,senderFrame:frame};const invoke=(c:string,payload:unknown)=>handlers.get(c)!(event,{requestId:crypto.randomUUID(),version:1,payload});
    assert.deepEqual(await invoke(CHANNELS.ping,null),{status:'ok',foundation:true});
    await assert.rejects(()=>invoke(CHANNELS.projectAdd,{code:'../bad',customer:'X',siteAddress:'Y'}));
    await invoke(CHANNELS.projectAdd,{code:'SYN-123',customer:'Fictional',siteAddress:'1 Sample St'});
    assert.equal((await invoke(CHANNELS.projectList,null) as any[]).length,1);
    await assert.rejects(()=>handlers.get(CHANNELS.projectList)!({sender:{id:7},senderFrame:frame},{requestId:crypto.randomUUID(),version:1,payload:null}));
    store.close();
  }finally{rm(dir);}
});


test('IPC project handlers use reopened SQLite connection after backup-style restore',async()=>{
  const dir=mkTemp();
  try{
    const primary={id:109},url='tmapp://app/index.html',frame:any={url};frame.top=frame;
    const handlers=new Map<string,(event:any,request:any)=>Promise<unknown>>();
    const dbFile=path.join(dir,'app.sqlite');
    let store=new LocalStore(dbFile);store.initializeFictionalCompany();
    registerFoundationHandlers({handle:(ch,h)=>{handlers.set(ch,h)}},{primary,url,getStore:()=>store});
    const event={sender:primary,senderFrame:frame};
    const invoke=(channel:string,payload:unknown)=>handlers.get(channel)!(event,{requestId:crypto.randomUUID(),version:1,payload});
    await invoke(CHANNELS.projectAdd,{code:'SYN-RESTORE',customer:'Fictional',siteAddress:'10 Test Way'});
    store.close();
    store=new LocalStore(dbFile); // Restore handler replaces the live LocalStore instance.
    const rows=await invoke(CHANNELS.projectList,null) as {project_code:string}[];
    assert.equal(rows[0].project_code,'SYN-RESTORE');
    await invoke(CHANNELS.projectAdd,{code:'SYN-AFTER',customer:'Fictional',siteAddress:'20 Test Way'});
    assert.deepEqual(store.listProjects().map(p=>p.project_code),['SYN-AFTER','SYN-RESTORE']);
    store.close();
  } finally {rm(dir)}
});

test('packaged renderer CSP remains strict while dev transform is opt-in',()=>{
  const html=fs.readFileSync(path.join(process.cwd(),'apps/desktop/index.html'),'utf8');
  const config=fs.readFileSync(path.join(process.cwd(),'apps/desktop/vite.renderer.config.ts'),'utf8');
  assert.match(html,/content-security-policy/i);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/style-src 'self'/);
  assert.doesNotMatch(html,/unsafe-inline|unsafe-eval|ws:\/\/localhost/);
  assert.match(config,/apply: 'serve'/);
  assert.match(config,/style-src 'self' 'unsafe-inline'/);
  assert.match(config,/ws:\/\/localhost/);
  assert.match(config,/refusing to weaken an unknown page/);
});


test('Vite dev CSP transformer preserves strict packaged HTML and permits local HMR styles only',()=>{
  const ts=require('typescript') as typeof import('typescript');
  const vm=require('node:vm') as typeof import('node:vm');
  const configPath=path.join(process.cwd(),'apps/desktop/vite.renderer.config.ts');
  const html=fs.readFileSync(path.join(process.cwd(),'apps/desktop/index.html'),'utf8');
  const result=ts.transpileModule(fs.readFileSync(configPath,'utf8'),{
    fileName:configPath,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
    reportDiagnostics:true
  });
  assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const exports:{default?:{plugins:Array<{name:string;apply:string;transformIndexHtml:(html:string)=>string}>}}={};
  vm.runInNewContext(result.outputText,{
    exports,
    require:(id:string)=>{
      if(id==='vite')return {defineConfig:(config:unknown)=>config};
      throw new Error('Unexpected config dependency: '+id);
    }
  },{timeout:1000,filename:configPath});
  const devPlugin=exports.default?.plugins.find(x=>x.name==='fork-b-development-csp');
  assert.ok(devPlugin);
  assert.equal(devPlugin.apply,'serve');
  const developmentHtml=devPlugin.transformIndexHtml(html);
  assert.match(developmentHtml,/style-src 'self' 'unsafe-inline'/);
  assert.match(developmentHtml,/connect-src 'self' ws:\/\/localhost:\*/);
  assert.doesNotMatch(developmentHtml,/unsafe-eval/);
  assert.doesNotMatch(html,/unsafe-inline|unsafe-eval|ws:\/\/localhost/);
  assert.match(html,/connect-src 'none'/);
  assert.throws(()=>devPlugin.transformIndexHtml('<html><title>Unknown page</title></html>'),/Expected one production CSP/);
});


test('repository audit rejects unexplained paths and floating workflow action versions',()=>{
 const {spawnSync}=require('node:child_process') as typeof import('node:child_process');
 const dir=mkTemp();try{
  fs.mkdirSync(path.join(dir,'scripts'));fs.mkdirSync(path.join(dir,'.github','workflows'),{recursive:true});
  fs.copyFileSync('scripts/audit-repo-structure.mjs',path.join(dir,'scripts','audit-repo-structure.mjs'));
  // The audit now uses the pinned TypeScript parser and project resolution config.
  // Preserve the original extra-path/action-pin failure and clean-pass oracles.
  fs.mkdirSync(path.join(dir,'apps','desktop'),{recursive:true});
  fs.mkdirSync(path.join(dir,'node_modules'),{recursive:true});
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')),path.join(dir,'node_modules','typescript'),process.platform==='win32'?'junction':'dir');
  fs.copyFileSync('tsconfig.base.json',path.join(dir,'tsconfig.base.json'));
  fs.copyFileSync('apps/desktop/tsconfig.json',path.join(dir,'apps','desktop','tsconfig.json'));

  const workflow=path.join(dir,'.github','workflows','ci.yml');
  fs.writeFileSync(workflow,'steps:\n  - uses: actions/checkout@v4\n');
  fs.writeFileSync(path.join(dir,'unexpected-source.ts'),'export const x=1;');
  const failure=spawnSync(process.execPath,[path.join(dir,'scripts','audit-repo-structure.mjs')],{encoding:'utf8',windowsHide:true});
  assert.equal(failure.status,1,failure.stderr);
  const report=JSON.parse(failure.stdout);assert.equal(report.status,'FAIL');
  assert.ok(report.violations.some((v:string)=>v.includes('Untracked architecture/support path')));
  assert.ok(report.violations.some((v:string)=>v.includes('Unpinned workflow action')));
  fs.rmSync(path.join(dir,'unexpected-source.ts'));
  fs.writeFileSync(workflow,'steps:\n  - uses: actions/checkout@'+'a'.repeat(40)+'\n');
  const success=spawnSync(process.execPath,[path.join(dir,'scripts','audit-repo-structure.mjs')],{encoding:'utf8',windowsHide:true});
  assert.equal(success.status,0,success.stderr);assert.equal(JSON.parse(success.stdout).status,'PASS');
 }finally{rm(dir);}
});

test('database mutation operation IDs cannot be replayed after reopen or reused across channels',async()=>{
 const dir=mkTemp();try{
  const primary={id:21},url='tmapp://app/index.html',frame:any={url};frame.top=frame;
  const handlers=new Map<string,(event:any,request:any)=>Promise<unknown>>();
  const file=path.join(dir,'app.sqlite');let db=new LocalStore(file);db.initializeFictionalCompany();
  try{
   const event={sender:primary,senderFrame:frame};
   const register=()=>registerFoundationHandlers({handle:(ch,h)=>handlers.set(ch,h)},{primary,url,getStore:()=>db});
   register();const id=db.createProject({code:'REPLAY',customer:'Before',siteAddress:'Site'});
   const op=crypto.randomUUID();const invoke=(ch:string,requestId:string,payload:unknown)=>handlers.get(ch)!(event,{requestId,version:1,payload});
   await invoke(CHANNELS.projectEdit,op,{id,code:'REPLAY',customer:'After',siteAddress:'Site'});
   db.close();db=new LocalStore(file);handlers.clear();register();
   await assert.rejects(()=>invoke(CHANNELS.projectEdit,op,{id,code:'REPLAY',customer:'Unexpected replay',siteAddress:'Site'}),/duplicate mutation/);
   await assert.rejects(()=>invoke(CHANNELS.projectStatus,op,{id,status:'archived'}),/duplicate mutation/);
   assert.equal(db.listProjectsDetailed()[0].customer_name,'After');assert.equal(db.listProjectsDetailed()[0].status,'active');
   assert.equal((db.db.prepare('SELECT count(*) AS n FROM audit_events').get() as {n:number}).n,2);
   const failed=crypto.randomUUID();
   await assert.rejects(()=>invoke(CHANNELS.projectAdd,failed,{code:'REPLAY',customer:'Duplicate',siteAddress:'Site'}));
   await invoke(CHANNELS.projectAdd,failed,{code:'RECOVERED',customer:'Recovered',siteAddress:'Site'});
   assert.equal(db.listProjects().length,2);
  }finally{db.close();}
 }finally{rm(dir);}
});

test('flat-paint contrast oracle preserves alpha composition and standard luminance ratios',async()=>{
 const {contrastForPaint}=await import('../e2e/cockpit-flow.spec');
 assert.equal(contrastForPaint('rgb(0, 0, 0)',['rgb(255, 255, 255)']),21);
 assert.equal(contrastForPaint('rgb(255, 255, 255)',['rgb(255, 255, 255)']),1);
 assert.equal(contrastForPaint('rgb(0, 0, 0)',['rgb(0, 0, 0)','rgba(255, 255, 255, 1)']),21);
 assert.equal(contrastForPaint('rgba(0, 0, 0, 0)',['rgb(255, 255, 255)']),1);
 assert.throws(()=>contrastForPaint('red',['rgb(0, 0, 0)']),/Unsupported/);
});
