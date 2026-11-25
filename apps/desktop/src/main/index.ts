/** Phase 2 isolated construction build. Not production billing software.
 * Native packaged tests must be repeated on this exact source revision. */
import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, nativeTheme } from 'electron';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {LocalStore} from '../../../../packages/persistence-sqlite/src/connection';
import {CHANNELS,assertEnvelope,assertNoPayload} from '../../../../packages/contracts/src';
import {importImageFromPickedFile} from '../../../../packages/asset-vault/src/import-file';
import {verifyManagedImage} from '../../../../packages/asset-vault/src/verify-image';
import {saveSyntheticInvoicePdf,capturePdfExportTarget} from '../../../../packages/pdf/src/invoices/render-invoice';
import {createBackup} from '../../../../packages/backup/src/create-backup';
import {restoreBackup,verifyBackup} from '../../../../packages/backup/src/restore-backup';
import {BackupDestinationPreference} from '../../../../packages/backup/src/backup-destination';
import {ProtectedSecretFile} from './os/keychain';
import {isTrustedSender,type SenderEventLike} from './ipc/sender-guard';
import {createIpcBoundary,registerFoundationHandlers,type ValidatedRegistrar} from './ipc/register';
import {registerBackupHandlers} from './ipc/handlers/backups';
import {registerBrandingHandlers} from './ipc/handlers/settings';
import {createNativeFileDialogs} from './os/file-dialogs';
import {prepareApplicationPaths} from './os/paths';
import {runPackagedCockpitFlow,runPackagedSecurityFlow,runDevelopmentHmrFlow,captureRawProofState,rawProofPage,rawProofPreload,collectRawIpcProof,RAW_PROOF_URL} from '../../../../tests/e2e/cockpit-flow.spec';
import {storeImmutablePdf} from '../../../../packages/pdf/src/common/stored-pdf';
import {LocalOperationQueue} from '../../../../packages/application/src/use-cases/backup-restore';
import {createCockpitWindow} from './window';
import {establishSingleInstance} from './os/single-instance';
import {createStartupRecorder,resolveLifecycleProof,createShutdownCoordinator,createRendererFailureGate,selectRendererUrl} from './bootstrap';

protocol.registerSchemesAsPrivileged([{scheme:'tmapp',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
// Internal construction profile is intentionally separate from the owner's previously
// verified Phase 1 Mac data. Do not switch to a production data root before migration/backup proofs.
const isPackagedSmoke=process.argv.includes('--tm-smoke');
const lifecycleProof=isPackagedSmoke?resolveLifecycleProof(process.env):null;
const rawIpcProof=isPackagedSmoke&&process.argv.includes('--tm-raw-ipc-proof');
const P2_TEST_PROFILE=isPackagedSmoke
  ? lifecycleProof?.profile??fs.mkdtempSync(path.join(os.tmpdir(),'electrical-tm-packaged-smoke-'))
  : path.join(app.getPath('appData'),'ElectricalTMCockpit-P2-Internal');
fs.mkdirSync(P2_TEST_PROFILE,{recursive:true,mode:0o700});
app.setPath('userData',P2_TEST_PROFILE);
let mainWindow!:BrowserWindow;
const hasSingleInstanceLock=establishSingleInstance(app,()=>mainWindow);
let secondaryLaunches=0;
if(hasSingleInstanceLock)app.on('second-instance',()=>{secondaryLaunches++;});
if(!hasSingleInstanceLock){
  if(isPackagedSmoke)console.error('TM_SMOKE_FAIL: another instance is already active');
  app.quit();
}
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL:string|undefined;
function startPrimary(){
const recorder=createStartupRecorder(P2_TEST_PROFILE);
const paths=(()=>{try{return prepareApplicationPaths(P2_TEST_PROFILE,app.getAppPath(),process.resourcesPath,app.isPackaged);}catch(error){try{recorder.record('paths.prepare','fail');}catch{/* No unsafe diagnostic fallback. */}throw error;}})();
recorder.record('launch','begin');
const DATA_ROOT=paths.dataRoot;
let store:LocalStore;
let currentUrl:string;
const operationQueue=new LocalOperationQueue();
const shutdown=createShutdownCoordinator({drain:()=>operationQueue.drain(),close:()=>store?.close(),
 record:state=>recorder.record('shutdown',state),quit:()=>app.quit(),exit:code=>app.exit(code)});
app.on('before-quit',event=>shutdown.beforeQuit(()=>event.preventDefault()));
const backupPreference=new BackupDestinationPreference(paths.settings,P2_TEST_PROFILE);
const DEV_URL=typeof MAIN_WINDOW_VITE_DEV_SERVER_URL==='string'?MAIN_WINDOW_VITE_DEV_SERVER_URL:undefined;
async function run(){
  recorder.record('renderer.target','begin');
  try{currentUrl=selectRendererUrl(app.isPackaged,DEV_URL);}catch(error){recorder.record('renderer.target','fail');throw error;}
  if(rawIpcProof){if(!app.isPackaged||lifecycleProof||DEV_URL)throw new Error('Raw IPC proof requires a fresh isolated packaged profile');currentUrl=RAW_PROOF_URL;}
  recorder.record('renderer.target','pass');
  recorder.record('sqlite.open','begin');
  fs.mkdirSync(DATA_ROOT,{recursive:true,mode:0o700});
  const migrationsDir=paths.migrations;
  try{store=new LocalStore(paths.database,migrationsDir);}catch(error){recorder.record('sqlite.open','fail');throw error;}
  store.initializeFictionalCompany();
  recorder.record('sqlite.open','pass');
  const rendererRoot=path.resolve(app.getAppPath(),'.vite','renderer','main_window');
  if(!DEV_URL)protocol.handle('tmapp',request=>{
    if(rawIpcProof){const html=rawProofPage(request.url);return html===null?new Response('Not found',{status:404}):new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});}
    const url=new URL(request.url);
    if(url.hostname!=='app')return new Response('Not found',{status:404});
    const requestPath=url.pathname==='/'?'/index.html':url.pathname;
    const abs=path.resolve(rendererRoot,'.'+requestPath);
    if(!abs.startsWith(rendererRoot+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(abs).toString());
  });
  let rawBaseline:string|undefined;
  if(rawIpcProof){
    const id=store.createProject({code:'RAW-PROOF-CONTROL',customer:'Synthetic control',siteAddress:'Synthetic site'});
    rawBaseline=captureRawProofState(store.db,P2_TEST_PROFILE);
    const preload=path.join(P2_TEST_PROFILE,'raw-proof.cjs');fs.writeFileSync(preload,rawProofPreload(id),{flag:'wx',mode:0o600});
    // Separate proof-only window. The normal production cockpit retains its unchanged preload/CSP.
    mainWindow=new BrowserWindow({show:false,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false,nodeIntegrationInSubFrames:true}});
    mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    mainWindow.webContents.on('will-navigate',event=>event.preventDefault());
    mainWindow.webContents.session.setPermissionCheckHandler(()=>false);
    mainWindow.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  }else mainWindow=createCockpitWindow(__dirname,isPackagedSmoke);
  const win=mainWindow;
  const rendererFailure=createRendererFailureGate({record:(event,state)=>recorder.record(event,state),fail:()=>shutdown.fail()});
  win.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)rendererFailure.fail('renderer.load');});
  win.webContents.on('preload-error',()=>rendererFailure.fail('renderer.preload'));
  win.webContents.on('render-process-gone',()=>rendererFailure.fail('renderer.process'));
  recorder.record('renderer.load','begin');
  // All privileged channels use the same versioned, replay-checked and sanitized boundary.
  const safeHandle=createIpcBoundary(ipcMain,{primary:mainWindow.webContents,url:currentUrl,record:event=>recorder.record(event,'info')});
  registerFoundationHandlers({handle:(channel,handler)=>{
    safeHandle(channel,(event,request)=>operationQueue.run(()=>handler(event,request)));
  }},{primary:mainWindow.webContents,url:currentUrl,getStore:()=>store});
  // Every privileged command must revalidate sender; never expose arbitrary filesystem paths.
  const guard=(e:SenderEventLike,r:unknown):unknown=>{
    if(!isTrustedSender(e,mainWindow.webContents,currentUrl))throw new Error('SECURITY: sender rejected');
    assertEnvelope(r);return (r as {payload:unknown}).payload;
  };
  const nativeDialogs=createNativeFileDialogs({open:options=>dialog.showOpenDialog(mainWindow,options),save:options=>dialog.showSaveDialog(mainWindow,options),confirm:options=>dialog.showMessageBox(mainWindow,options)});
  safeHandle(CHANNELS.fileImport,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));const selected=await nativeDialogs.pickReceipt();
    return selected===null?null:importImageFromPickedFile(selected,path.join(DATA_ROOT,'vault'));
  }));
  safeHandle(CHANNELS.pdfCreate,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));const selected=await nativeDialogs.choosePdf();
    if(selected===null)return null;
    const expectedExisting=await capturePdfExportTarget(selected,[P2_TEST_PROFILE]);
    let allowReplace=false;
    if(expectedExisting){
      if(!await nativeDialogs.confirmPdfReplace())return null;
      allowReplace=true;
    }
    return saveSyntheticInvoicePdf(selected,{company:'Synthetic Demo Electric Ltd.',customer:'Demo Customer',project:'SYNTHETIC-01',invoiceNumber:'TEST-0001',taxId:'FAKE-TAX-ID',contractorLicense:'FAKE-LICENSE',amount:'125.00'},{allowReplace,protectedRoots:[P2_TEST_PROFILE],expectedExisting});
  }));
  const registerBackup:ValidatedRegistrar=(channel,validate,operation)=>safeHandle(channel,(e,r)=>operationQueue.run(()=>{
    const payload=validate(guard(e,r));assertEnvelope(r);return operation(r.requestId,payload);
  }));
  registerBrandingHandlers(registerBackup,()=>store,async()=>{const selected=await nativeDialogs.pickLogo();return selected===null?null:importImageFromPickedFile(selected,path.join(DATA_ROOT,'vault'));});
  registerBackupHandlers(registerBackup,{dialogs:nativeDialogs,preference:backupPreference,dataRoot:DATA_ROOT,migrationsDir,
    getStore:()=>store,setStore:value=>{store=value;},reopen:()=>new LocalStore(paths.database,migrationsDir),
    onFatalRecovery:()=>{try{recorder.record('restore.recovery','fail');}catch{/* Fail closed even when diagnostics are unavailable. */}shutdown.fail();}});
  const secret=new ProtectedSecretFile(safeStorage,paths.secret);
  safeHandle(CHANNELS.fakeSecretStore,(e,r)=>operationQueue.run(async()=>{
    const val=guard(e,r);
    if(val!=='TEST-FAKE-EXAMPLE')throw new Error('Proof accepts only the fixed fake token');
    await secret.storeFakeToken('TEST-FAKE-EXAMPLE');return {stored:true};
  }));
  safeHandle(CHANNELS.fakeSecretCheck,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));return {stored:await secret.exists(),works:await secret.exists()?await secret.readFakeToken()==='TEST-FAKE-EXAMPLE':false};
  }));
  safeHandle(CHANNELS.fakeSecretRemove,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));await secret.remove();return {removed:true};
  }));
  const loadTarget=lifecycleProof?.stage==='revoked'&&process.env.TM_LIFECYCLE_INVALID_RENDERER_PROBE==='1'?'tmapp://app/nonexistent-synthetic-renderer.html':currentUrl;
  try{await mainWindow.loadURL(loadTarget);}catch(error){rendererFailure.fail('renderer.load');throw error;}
  if(loadTarget!==currentUrl){recorder.record('packaged.invalid-renderer-probe','fail');throw new Error('Synthetic invalid renderer did not reject');}
  rendererFailure.assertHealthy();
  recorder.record('renderer.load','pass');
  if(rawIpcProof){
    if(rawBaseline===undefined)throw new Error('Missing synthetic raw IPC baseline');
    const report=await collectRawIpcProof(win,()=>captureRawProofState(store.db,P2_TEST_PROFILE),rawBaseline);
    const receiptPath=process.env.TM_SMOKE_REPORT_PATH;
    if(!receiptPath||!path.isAbsolute(receiptPath))throw new Error('Missing native raw proof receipt destination');
    fs.writeFileSync(receiptPath,JSON.stringify(report)+'\n',{flag:'wx',mode:0o600});
    recorder.record('packaged.raw-ipc','info');app.quit();return;
  }
  if(isPackagedSmoke&&process.argv.includes('--tm-dev-hmr-proof')){
    if(app.isPackaged||!DEV_URL||!isPackagedSmoke||lifecycleProof?.stage!=='seed')throw new Error('Development HMR proof requires its isolated marked profile and development server');
    const report=await runDevelopmentHmrFlow(win,lifecycleProof.nonce,before=>fs.writeFileSync(path.join(P2_TEST_PROFILE,'dev-hmr-ready.json'),JSON.stringify({nonce:lifecycleProof.nonce,before}),{flag:'wx',mode:0o600}));
    fs.writeFileSync(path.join(P2_TEST_PROFILE,'dev-hmr-result.json'),JSON.stringify(report)+'\n',{flag:'wx',mode:0o600});
    recorder.record('development.hmr','pass');app.quit();return;
  }
  if(lifecycleProof){
    // The runner launches the same packaged executable three separate times.
    // Every mutation/read here uses the real isolated renderer bridge.
    if(!app.isPackaged||DEV_URL)throw new Error('Lifecycle proof requires a packaged executable');
    const stage=lifecycleProof.stage;
    // Only the already validated disposable packaged lifecycle profile may request a real crash.
    if(stage==='revoked'&&process.env.TM_LIFECYCLE_RENDERER_CRASH_PROBE==='1'){
      win.webContents.forcefullyCrashRenderer();
      return;
    }
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const stage=${JSON.stringify(stage)};
      if(stage==='seed'){
        if((await window.tmBridge.listProjectsDetailed()).length!==0)throw new Error('Lifecycle seed profile not empty');
        await window.tmBridge.createProject({code:'LIFECYCLE-001',customer:'Synthetic Lifecycle',siteAddress:'1 Site Rd',details:{name:'Lifecycle fixture',billingAddress:'2 Billing Rd',notes:'Synthetic only'}});
        await window.tmBridge.storeFakeSecretProof();
      }
      const rows=await window.tmBridge.listProjectsDetailed();
      if(rows.length!==1)throw new Error('Unexpected lifecycle fixture count');
      const row=rows[0];
      if(row.project_code!=='LIFECYCLE-001'||row.site_address!=='1 Site Rd'||row.billing_address!=='2 Billing Rd'||row.project_name!=='Lifecycle fixture')throw new Error('Lifecycle fixture mismatch');
      const before=await window.tmBridge.checkFakeSecretProof();
      if(stage==='revoked'?(before.stored||before.works):(!before.stored||!before.works))throw new Error('Lifecycle credential state mismatch');
      if(stage==='reopen'){
        await window.tmBridge.removeFakeSecretProof();
        const after=await window.tmBridge.checkFakeSecretProof();
        if(after.stored||after.works)throw new Error('Lifecycle revocation failed');
      }
      if(stage!=='seed'){
        const deadline=Date.now()+10000;
        while(Date.now()<deadline&&!document.querySelector('.project-list')?.textContent?.includes('LIFECYCLE-001'))await new Promise(resolve=>setTimeout(resolve,50));
        if(!document.querySelector('.project-list')?.textContent?.includes('LIFECYCLE-001')||!document.querySelector('.project-list')?.textContent?.includes('2 Billing Rd'))throw new Error('Project not rendered automatically after restart');
      }
      return {projectId:row.id,openedUtc:row.opened_utc,credential:stage==='revoked'?'absent':stage==='reopen'?'read-and-revoked':'stored',automaticReload:stage!=='seed'};
    })()`);
    if(stage==='seed'){
      const ciphertext=fs.readFileSync(path.join(P2_TEST_PROFILE,'secrets','phase1-fake.bin'));
      if(ciphertext.includes(Buffer.from('TEST-FAKE-EXAMPLE')))throw new Error('Lifecycle credential plaintext');
    }
    if(stage==='revoked'&&process.env.TM_LIFECYCLE_DUPLICATE_PROBE==='1'){
      // Native runner controls only this previously validated disposable profile.
      fs.writeFileSync(path.join(P2_TEST_PROFILE,'duplicate-ready.json'),JSON.stringify({nonce:lifecycleProof.nonce,pid:process.pid}),{flag:'wx',mode:0o600});
      const deadline=Date.now()+20000;
      while(Date.now()<deadline&&secondaryLaunches===0)await new Promise(resolve=>setTimeout(resolve,50));
      if(secondaryLaunches!==1)throw new Error('Duplicate instance was not rejected');
      recorder.record('packaged.lifecycle.duplicate','pass');
    }
    fs.writeFileSync(path.join(P2_TEST_PROFILE,`lifecycle-${stage}.json`),JSON.stringify({schema:'tm-lifecycle-v1',stage,nonce:lifecycleProof.nonce,pid:process.pid,synthetic:true,...result,secondaryLaunches})+'\n',{flag:'wx',mode:0o600});
    recorder.record('packaged.lifecycle.'+stage,'pass');
    app.quit();return;
  }
  if(isPackagedSmoke){
    // A native packaged smoke runs ONLY with its own temporary synthetic profile.
    // This test is not a substitute for a clean-machine or independent human review.
    const checks:string[]=[];
    let currentCheck='packaging';
    let succeeded=false;
    let cockpitFlow:Awaited<ReturnType<typeof runPackagedCockpitFlow>>|null=null;
    let packagedHealth=false,packagedOrigin:string|null=null;
    let startupReadiness:{elapsedMs:number;title:string;rootWidth:number;rootHeight:number;heading:string;health:boolean}|null=null;
    let rendererSecurity:Awaited<ReturnType<typeof runPackagedSecurityFlow>>|null=null;
    try {
      if(!app.isPackaged||DEV_URL)throw new Error('Not an independent packaged runtime');
      checks.push(currentCheck);
      currentCheck='renderer-ipc';
      const probe=await win.webContents.executeJavaScript(`(async()=>{
        const health=await window.tmBridge.ping();
        const root=document.querySelector('#root');const rect=root?.getBoundingClientRect();
        const heading=root?.querySelector('h1');
        return {title:document.title,rootWidth:rect?.width??0,rootHeight:rect?.height??0,
          heading:heading?.textContent??'',health:health.status==='ok'&&health.foundation===true,
          rendered:!!root&&getComputedStyle(root).display!=='none'&&getComputedStyle(root).visibility==='visible'};
      })()`);
      startupReadiness={elapsedMs:Math.ceil(process.uptime()*1000),title:probe.title,rootWidth:probe.rootWidth,rootHeight:probe.rootHeight,heading:probe.heading,health:probe.health};
      if(!probe.rendered||!startupReadiness.title.includes('Electrical T&M')||startupReadiness.heading!=='Local foundation cockpit'||!startupReadiness.health||startupReadiness.rootWidth<=0||startupReadiness.rootHeight<=0||startupReadiness.elapsedMs>15000)throw new Error('Packaged renderer readiness oracle failed');
      packagedHealth=true;packagedOrigin=win.webContents.getURL();
      if(packagedOrigin!=='tmapp://app/index.html')throw new Error('Unexpected packaged renderer origin');
      // Disposable project and full logical mutation census, never production data.
      const securityProject=store.createProject({code:'SECURITY-CONTROL-001',customer:'Synthetic security control',siteAddress:'Synthetic site'});
      const snapshot=()=>captureRawProofState(store.db,P2_TEST_PROFILE);
      // A distinct native WebContents with the same preload and URL must still be denied.
      const foreign=createCockpitWindow(__dirname,true);
      let navigationAttempts=0;
      const observeNavigation=()=>{navigationAttempts++;};
      win.webContents.on('will-navigate',observeNavigation);
      try{await foreign.loadURL(currentUrl);rendererSecurity=await runPackagedSecurityFlow(win,foreign,securityProject,snapshot,()=>navigationAttempts);}
      finally{win.webContents.removeListener('will-navigate',observeNavigation);foreign.destroy();}
      cockpitFlow=await runPackagedCockpitFlow(win,nativeTheme);
      checks.push(currentCheck);

      currentCheck='sqlite-persistence';
      const id=store.createProject({code:'SMOKE-001',customer:'Synthetic Check',siteAddress:'1 Test Road'});
      if(!store.listProjects().some(p=>p.id===id))throw new Error('Project could not be read back');
      // Reopen the actual database and reload the renderer: no manual Refresh action.
      store.close();
      store=new LocalStore(paths.database,migrationsDir);
      await win.loadURL(currentUrl);
      const visible=await win.webContents.executeJavaScript(`(async()=>{
        const deadline=Date.now()+10000;
        while(Date.now()<deadline){
          if(document.querySelector('.project-list')?.textContent?.includes('SMOKE-001'))return true;
          await new Promise(resolve=>setTimeout(resolve,50));
        }
        return false;
      })()`);
      if(visible!==true)throw new Error('Persisted project did not load in renderer');
      checks.push(currentCheck);

      currentCheck='pdf-create-and-replace';
      const artifactPath=path.join(DATA_ROOT,'artifacts','smoke-invoice.pdf');
      const invoice={company:'Synthetic Demo Electric Ltd.',customer:'Demo Customer',project:'SMOKE-001',
        invoiceNumber:'SMOKE-0001',taxId:'FAKE-TAX-ID',contractorLicense:'FAKE-LICENSE',amount:'125.00'};
      await saveSyntheticInvoicePdf(artifactPath,invoice);
      const original=fs.readFileSync(artifactPath);
      if(!original.subarray(0,8).toString('ascii').startsWith('%PDF-')||
         !original.includes(Buffer.from('FAKE-LICENSE'))||!original.includes(Buffer.from('FAKE-TAX-ID')))
        throw new Error('Synthetic PDF lacks required document fields');
      let refusedReplacement=false;
      try {await saveSyntheticInvoicePdf(artifactPath,invoice);}
      catch(error){refusedReplacement=(error as NodeJS.ErrnoException).code==='EEXIST';}
      if(!refusedReplacement)throw new Error('Unconfirmed replacement was not rejected');
      await saveSyntheticInvoicePdf(artifactPath,invoice,{allowReplace:true});
      if(!fs.readFileSync(artifactPath).equals(original))throw new Error('Confirmed PDF replace changed content');
      const issued=await storeImmutablePdf(path.join(DATA_ROOT,'artifacts'),original);
      const originalPath=path.join(DATA_ROOT,'artifacts',issued.relativePath);
      let protectedRejected=false;
      try{await saveSyntheticInvoicePdf(originalPath,{...invoice,amount:'999.00'},{allowReplace:true,protectedRoots:[P2_TEST_PROFILE]});}catch{protectedRejected=true;}
      if(!protectedRejected||!fs.readFileSync(originalPath).equals(original))throw new Error('Issued evidence export boundary failed');
      store.db.prepare('INSERT INTO issued_invoices(id,project_id,invoice_number,immutable_body_json,issued_utc,amount_cents,pdf_sha256,pdf_locator) VALUES(?,?,?,?,?,?,?,?)')
       .run('synthetic-smoke-invoice',id,'SMOKE-0001','{}','2026-11-23T00:00:00Z',12500,issued.sha256,issued.relativePath);
      checks.push(currentCheck);

      currentCheck='asset-vault';
      const fixturePath=path.join(P2_TEST_PROFILE,'smoke-input.png');
      // One synthetic 24x24 PNG; never use a contractor receipt in automated smoke.
      fs.writeFileSync(fixturePath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAIAAABvFaqvAAAAIklEQVR4nGP8//8/AzUAE1VMGTVo1KBRg0YNGjVo1CCKAAAZ0QMtxqFhfwAAAABJRU5ErkJggg==','base64'),{mode:0o600});
      const imported=await importImageFromPickedFile(fixturePath,path.join(DATA_ROOT,'vault'));
      const verified=await verifyManagedImage(path.join(DATA_ROOT,'vault'),imported.relativePath,imported.sha256);
      if(verified.mime!=='image/png')throw new Error('Synthetic receipt import failed verification');
      store.db.prepare('INSERT INTO purchase_sources(id,business_id,source_hash,kind,vault_locator,added_utc) VALUES(?,?,?,?,?,?)').run('synthetic-smoke-receipt','local',imported.sha256,'receipt',imported.relativePath,'2026-11-23T00:00:00Z');
      // A separate managed logo reference is part of backup acceptance, not an invoice-rendering claim.
      const logo=await importImageFromPickedFile(fixturePath,path.join(DATA_ROOT,'vault'));
      if(logo.id===imported.id)throw new Error('Logo identity is not separate');
      store.setBusinessLogo({...logo,mime:logo.mime==='image/png'?'image/png':'image/jpeg'});
      checks.push(currentCheck);

      currentCheck='native-os-credential';
      await secret.storeFakeToken('TEST-FAKE-EXAMPLE');
      if(!await secret.exists()||await secret.readFakeToken()!=='TEST-FAKE-EXAMPLE')
        throw new Error('OS protected secret cannot be round-tripped');
      const ciphertext=fs.readFileSync(path.join(P2_TEST_PROFILE,'secrets','phase1-fake.bin'));
      if(ciphertext.includes(Buffer.from('TEST-FAKE-EXAMPLE')))throw new Error('Secret stored as plaintext');
      const reopenedSecret=new ProtectedSecretFile(safeStorage,path.join(P2_TEST_PROFILE,'secrets','phase1-fake.bin'));
      if(await reopenedSecret.readFakeToken()!=='TEST-FAKE-EXAMPLE')throw new Error('Persisted protected secret could not be reopened');
      await reopenedSecret.remove();
      if(await new ProtectedSecretFile(safeStorage,path.join(P2_TEST_PROFILE,'secrets','phase1-fake.bin')).exists())throw new Error('OS protected secret could not be revoked');
      checks.push(currentCheck);

      currentCheck='backup-integrity-restore';
      const backupDestination=path.join(P2_TEST_PROFILE,'backup-test-exports');
      const result=await createBackup(store,DATA_ROOT,backupDestination);
      const manifest=await verifyBackup(result.backupPath,migrationsDir);
      if(!manifest.files.some(f=>f.path.startsWith('vault/images/'))||
         !manifest.files.some(f=>f.path==='artifacts/smoke-invoice.pdf')||!manifest.files.some(f=>f.path==='vault/'+logo.relativePath&&f.sha256===logo.sha256))
        throw new Error('Backup omitted synthetic assets');
      // Tamper with the backup artifact, not the live original, and prove rejection.
      const archivedPdf=path.join(result.backupPath,'artifacts','smoke-invoice.pdf');
      fs.appendFileSync(archivedPdf,'synthetic-tamper');
      let tamperRejected=false;
      try{await verifyBackup(result.backupPath,migrationsDir);}catch{tamperRejected=true;}
      if(!tamperRejected||!fs.readFileSync(artifactPath).equals(original))throw new Error('Tamper was not safely rejected');
      fs.writeFileSync(archivedPdf,original);
      await verifyBackup(result.backupPath,migrationsDir);
      store.createProject({code:'SMOKE-LATER',customer:'Synthetic Check',siteAddress:'2 Test Road'});
      store.close();
      await restoreBackup(result.backupPath,DATA_ROOT,migrationsDir);
      store=new LocalStore(paths.database,migrationsDir);
      if(!store.listProjects().some(p=>p.id===id)||store.listProjects().some(p=>p.project_code==='SMOKE-LATER')||
         !fs.existsSync(path.join(DATA_ROOT,'artifacts','smoke-invoice.pdf'))||
         !fs.existsSync(path.join(DATA_ROOT,'vault',imported.relativePath))||store.getBusinessLogo()?.id!==logo.id||!fs.existsSync(path.join(DATA_ROOT,'vault',logo.relativePath)))
        throw new Error('Native backup restore lost project or attachments');
      checks.push(currentCheck);
      succeeded=true;
    }catch(_error){
      // Log only named synthetic check identifiers. Do not reveal filesystem, OS vault data or customer fields.
      recorder.record('packaged.smoke.'+currentCheck,'fail');
    }
    const report={schema:'tm-native-smoke-v3',passed:checks,failed:succeeded?null:currentCheck,
      source:'packaged-binary',synthetic:true,cockpitFlow,rendererSecurity,packagedOrigin,packagedHealth,startupReadiness};
    // Windows GUI executables do not guarantee that stdout is attached to a terminal.
    // The native runner supplies a new, unpredictable, temp-only evidence path.
    const receiptPath=process.env.TM_SMOKE_REPORT_PATH;
    if(receiptPath){
      try{
        if(!path.isAbsolute(receiptPath)||!fs.existsSync(path.dirname(receiptPath)))
          throw new Error('Missing native evidence destination');
        fs.writeFileSync(receiptPath,JSON.stringify(report)+'\n',{flag:'wx',mode:0o600});
      }catch{
        succeeded=false;
        recorder.record('packaged.smoke.receipt','fail');
      }
    }
    console.log('TM_PACKAGED_SMOKE_REPORT:'+JSON.stringify(report));
    recorder.record('packaged.smoke',succeeded?'pass':'fail');
    console.log(succeeded?'TM_PACKAGED_SMOKE_OK':'TM_SMOKE_FAIL');
    try{store?.close();}catch{/* The process exits with failure if a prior operation broke SQLite. */}
    app.exit(succeeded?0:1);
  }}
  app.whenReady().then(run).catch(_error=>{
    try{recorder.record('startup','fail');}catch{/* Fail closed even when diagnostics are unavailable. */}
    console.error('Electrical T&M startup failed; see local diagnostics/startup.jsonl (no secrets logged).');
    shutdown.fail();
  });
// This single-window Phase 1 proof exits fully on macOS as well: no hidden
// app instance retaining a lock or requiring a separate process cleanup.
app.on('window-all-closed',()=>app.quit());
}
if(hasSingleInstanceLock){
 try{startPrimary();}catch{console.error('Electrical T&M application data could not be safely opened.');app.exit(1);}
}
