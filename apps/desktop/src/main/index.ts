/** Phase 2 isolated construction build. Not production billing software.
 * Native packaged tests must be repeated on this exact source revision. */
import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage } from 'electron';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {LocalStore} from '../../../../packages/persistence-sqlite/src/connection';
import {CHANNELS,assertEnvelope,assertNoPayload,createRequestReplayGuard,type IpcResult} from '../../../../packages/contracts/src';
import {classifyIpcError} from '../../../../packages/contracts/src/ipc/error-envelope';
import {importImageFromPickedFile} from '../../../../packages/asset-vault/src/import-file';
import {verifyManagedImage} from '../../../../packages/asset-vault/src/verify-image';
import {saveSyntheticInvoicePdf} from '../../../../packages/pdf/src/invoices/render-invoice';
import {createBackup} from '../../../../packages/backup/src/create-backup';
import {restoreBackup,verifyBackup} from '../../../../packages/backup/src/restore-backup';
import {BackupDestinationPreference} from '../../../../packages/backup/src/backup-destination';
import {ProtectedSecretFile} from './os/keychain';
import {isTrustedSender} from './ipc/sender-guard';
import {registerFoundationHandlers} from './ipc/register';
import {LocalOperationQueue} from '../../../../packages/application/src/use-cases/backup-restore';
import {createCockpitWindow} from './window';
import {establishSingleInstance} from './os/single-instance';
import {createStartupRecorder} from './bootstrap';

protocol.registerSchemesAsPrivileged([{scheme:'tmapp',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
// Internal construction profile is intentionally separate from the owner's previously
// verified Phase 1 Mac data. Do not switch to a production data root before migration/backup proofs.
const isPackagedSmoke=process.argv.includes('--tm-smoke');
const P2_TEST_PROFILE=isPackagedSmoke
  ? fs.mkdtempSync(path.join(os.tmpdir(),'electrical-tm-packaged-smoke-'))
  : path.join(app.getPath('appData'),'ElectricalTMCockpit-P2-Internal');
fs.mkdirSync(P2_TEST_PROFILE,{recursive:true,mode:0o700});
app.setPath('userData',P2_TEST_PROFILE);
let mainWindow!:BrowserWindow;
const hasSingleInstanceLock=establishSingleInstance(app,()=>mainWindow);
if(!hasSingleInstanceLock){
  if(isPackagedSmoke)console.error('TM_SMOKE_FAIL: another instance is already active');
  app.quit();
}
const recorder=createStartupRecorder(P2_TEST_PROFILE);
recorder.record('launch','begin');
const DATA_ROOT=path.join(app.getPath('userData'),'local-data');
let store:LocalStore;
let currentUrl:string;
const operationQueue=new LocalOperationQueue();
const backupPreference=new BackupDestinationPreference(path.join(app.getPath('userData'),'settings','backup-location.json'),DATA_ROOT);
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL:string|undefined;
const DEV_URL=typeof MAIN_WINDOW_VITE_DEV_SERVER_URL==='string'?MAIN_WINDOW_VITE_DEV_SERVER_URL:undefined;
async function run(){
  recorder.record('sqlite.open','begin');
  fs.mkdirSync(DATA_ROOT,{recursive:true,mode:0o700});
  const migrationsDir=app.isPackaged?path.join(process.resourcesPath,'migrations'):path.resolve(app.getAppPath(),'../../packages/persistence-sqlite/src/migrations');
  store=new LocalStore(path.join(DATA_ROOT,'db','app.sqlite'),migrationsDir);
  store.initializeFictionalCompany();
  recorder.record('sqlite.open','pass');
  const rendererRoot=path.resolve(app.getAppPath(),'.vite','renderer','main_window');
  if(!DEV_URL)protocol.handle('tmapp',request=>{
    const url=new URL(request.url);
    if(url.hostname!=='app')return new Response('Not found',{status:404});
    const requestPath=url.pathname==='/'?'/index.html':url.pathname;
    const abs=path.resolve(rendererRoot,'.'+requestPath);
    if(!abs.startsWith(rendererRoot+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(abs).toString());
  });
  mainWindow=createCockpitWindow(__dirname,isPackagedSmoke);
  const win=mainWindow;
  win.webContents.on('did-fail-load',(_event,_code,_description)=>recorder.record('renderer.load','fail'));
  win.webContents.on('render-process-gone',()=>recorder.record('renderer.process','fail'));
  recorder.record('renderer.load','begin');
  currentUrl=DEV_URL?new URL(DEV_URL).toString():'tmapp://app/index.html';
  // All privileged channels use one versioned, replay-checked and sanitized boundary.
  const claimRequest=createRequestReplayGuard();
  const safeHandle=(channel:string,handler:(event:Electron.IpcMainInvokeEvent,request:unknown)=>Promise<unknown>)=>{
    ipcMain.handle(channel,async(event,request):Promise<IpcResult<unknown>>=>{
      let requestId:string=randomUUID();
      try{
        if(!isTrustedSender(event as any,mainWindow.webContents as any,currentUrl))throw new Error('SECURITY: sender rejected');
        assertEnvelope(request);
        requestId=request.requestId;
        claimRequest(requestId);
        return {ok:true,requestId,data:await handler(event,request)};
      }catch(error){
        const publicError=classifyIpcError(error);
        recorder.record('ipc.'+publicError.code.toLowerCase(),'info');
        return {ok:false,requestId,error:{...publicError,retryable:publicError.code==='UNAVAILABLE',correlationId:requestId}};
      }
    });
  };
  registerFoundationHandlers({handle:(channel,handler)=>{
    safeHandle(channel,(event,request)=>operationQueue.run(()=>handler(event as any,request)));
  }},{primary:mainWindow.webContents,url:currentUrl,getStore:()=>store});
  // Every privileged command must revalidate sender; never expose arbitrary filesystem paths.
  const guard=(e:Electron.IpcMainInvokeEvent,r:unknown):unknown=>{
    if(!isTrustedSender(e as any,mainWindow.webContents as any,currentUrl))throw new Error('SECURITY: sender rejected');
    assertEnvelope(r);return (r as {payload:unknown}).payload;
  };
  safeHandle(CHANNELS.fileImport,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));
    const selected=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],filters:[{name:'Receipt photo',extensions:['png','jpg','jpeg']}]});
    if(selected.canceled||selected.filePaths.length!==1)return null;
    return importImageFromPickedFile(selected.filePaths[0],path.join(DATA_ROOT,'vault'));
  }));
  safeHandle(CHANNELS.pdfCreate,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));
    const selected=await dialog.showSaveDialog(mainWindow,{defaultPath:'synthetic-invoice-proof.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
    if(selected.canceled||!selected.filePath)return null;
    let allowReplace=false;
    if(fs.existsSync(selected.filePath)){
      // macOS Save dialog may have shown Replace. Confirm again in-app before altering a file.
      const confirmation=await dialog.showMessageBox(mainWindow,{
        type:'warning',title:'Replace existing synthetic PDF?',
        message:'A file with this name already exists.',
        detail:'Replace only this synthetic test PDF? This operation never edits issued invoice records.',
        buttons:['Keep existing file','Replace synthetic PDF'],defaultId:0,cancelId:0
      });
      if(confirmation.response!==1)return null;
      allowReplace=true;
    }
    return saveSyntheticInvoicePdf(selected.filePath,{company:'Synthetic Demo Electric Ltd.',customer:'Demo Customer',project:'SYNTHETIC-01',invoiceNumber:'TEST-0001',taxId:'FAKE-TAX-ID',contractorLicense:'FAKE-LICENSE',amount:'125.00'},{allowReplace,protectedRoots:[P2_TEST_PROFILE]});
  }));
  safeHandle(CHANNELS.backupGetLocation,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));return {folder:await backupPreference.get()};
  }));
  safeHandle(CHANNELS.backupChooseLocation,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));
    const selected=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory','createDirectory']});
    if(selected.canceled||selected.filePaths.length!==1)return null;
    return {folder:await backupPreference.set(selected.filePaths[0])};
  }));
  safeHandle(CHANNELS.backupCreateStored,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));
    const folder=await backupPreference.get();
    if(!folder)throw new Error('Select a backup folder before backing up');
    await backupPreference.validate(folder);
    return createBackup(store,DATA_ROOT,folder);
  }));
  safeHandle(CHANNELS.backupCreate,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));
    const selected=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory','createDirectory']});
    if(selected.canceled||selected.filePaths.length!==1)return null;
    const folder=await backupPreference.set(selected.filePaths[0]);
    return createBackup(store,DATA_ROOT,folder);
  }));
  safeHandle(CHANNELS.backupRestore,(e,r)=>operationQueue.run(async()=>{
    assertNoPayload(guard(e,r));
    const selected=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory']});
    if(selected.canceled||selected.filePaths.length!==1)return null;
    const backupPath=selected.filePaths[0];
    await verifyBackup(backupPath,migrationsDir); // prove schema compatibility before replacing current data
    const consent=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancel','Restore demo data'],defaultId:0,cancelId:0,
      title:'Restore synthetic records?',message:'Replace current local demo data with selected verified backup?',detail:'This Phase 1 proof is for fictional records only. The current profile will be held in a separate rollback folder.'});
    if(consent.response!==1)return null;
    store.close();
    let restored:{rollbackPath:string|null}|null=null;
    try{
      restored=await restoreBackup(backupPath,DATA_ROOT,migrationsDir);
      store=new LocalStore(path.join(DATA_ROOT,'db','app.sqlite'),migrationsDir);
      return {restored:true,rollbackPath:restored.rollbackPath};
    }catch(error){
      // Post-swap initialization is the final gate. Restore rescue if rebind fails.
      if(restored?.rollbackPath&&fs.existsSync(restored.rollbackPath)){
        const failed=DATA_ROOT+'.restore-failed-'+Date.now();
        if(fs.existsSync(DATA_ROOT))await fs.promises.rename(DATA_ROOT,failed);
        await fs.promises.rename(restored.rollbackPath,DATA_ROOT);
      }
      store=new LocalStore(path.join(DATA_ROOT,'db','app.sqlite'),migrationsDir);
      throw error;
    }
  }));
  const secret=new ProtectedSecretFile(safeStorage,path.join(app.getPath('userData'),'secrets','phase1-fake.bin'));
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
  if(DEV_URL)await mainWindow.loadURL(DEV_URL);else await mainWindow.loadURL(currentUrl);
  recorder.record('renderer.load','pass');
  if(isPackagedSmoke){
    // A native packaged smoke runs ONLY with its own temporary synthetic profile.
    // This test is not a substitute for a clean-machine or independent human review.
    const checks:string[]=[];
    let currentCheck='packaging';
    let succeeded=false;
    try {
      if(!app.isPackaged||DEV_URL)throw new Error('Not an independent packaged runtime');
      checks.push(currentCheck);
      currentCheck='renderer-ipc';
      const probe=await win.webContents.executeJavaScript(`(async()=>{
        const health=await window.tmBridge.ping();
        return {ok:health.status==='ok'&&document.title.includes('Electrical T&M')&&
          document.body?.textContent?.includes('Local foundation')};
      })()`);
      if(!probe?.ok)throw new Error('Packaged renderer or IPC failed');
      // A distinct native WebContents with the same preload and URL must still be denied.
      const foreign=createCockpitWindow(__dirname,true);
      try{
        await foreign.loadURL(currentUrl);
        const rejected=await foreign.webContents.executeJavaScript(`(async()=>{
          try{await window.tmBridge.ping();return false;}
          catch(error){return String(error).includes('SECURITY');}
        })()`);
        if(rejected!==true)throw new Error('Foreign renderer IPC was not rejected');
      }finally{foreign.destroy();}
      const isolation=await win.webContents.executeJavaScript(`({
        requireAbsent:typeof require==='undefined',processAbsent:typeof process==='undefined',
        bridgeKeys:Object.keys(window.tmBridge),
        csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content
      })`);
      if(!isolation.requireAbsent||!isolation.processAbsent||!Array.isArray(isolation.bridgeKeys)||
         isolation.bridgeKeys.includes('invoke')||!isolation.csp?.includes("connect-src 'none'")||
         isolation.csp.includes('unsafe-inline')||isolation.csp.includes('unsafe-eval'))
        throw new Error('Packaged isolation or CSP policy mismatch');
      const inlineBlocked=await win.webContents.executeJavaScript(`(async()=>{
        const script=document.createElement('script');
        script.textContent='window.__tmForbiddenInlineProbe=true';
        document.head.appendChild(script);
        await new Promise(resolve=>setTimeout(resolve,100));
        script.remove();return window.__tmForbiddenInlineProbe!==true;
      })()`);
      if(inlineBlocked!==true)throw new Error('Packaged CSP allowed inline script');
      checks.push(currentCheck);

      currentCheck='sqlite-persistence';
      const id=store.createProject({code:'SMOKE-001',customer:'Synthetic Check',siteAddress:'1 Test Road'});
      if(!store.listProjects().some(p=>p.id===id))throw new Error('Project could not be read back');
      // Reopen the actual database and reload the renderer: no manual Refresh action.
      store.close();
      store=new LocalStore(path.join(DATA_ROOT,'db','app.sqlite'),migrationsDir);
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
      checks.push(currentCheck);

      currentCheck='asset-vault';
      const fixturePath=path.join(P2_TEST_PROFILE,'smoke-input.png');
      // One synthetic 1x1 PNG; never use a contractor receipt in automated smoke.
      fs.writeFileSync(fixturePath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64'),{mode:0o600});
      const imported=await importImageFromPickedFile(fixturePath,path.join(DATA_ROOT,'vault'));
      const verified=await verifyManagedImage(path.join(DATA_ROOT,'vault'),imported.relativePath,imported.sha256);
      if(verified.mime!=='image/png')throw new Error('Synthetic receipt import failed verification');
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
         !manifest.files.some(f=>f.path==='artifacts/smoke-invoice.pdf'))
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
      store=new LocalStore(path.join(DATA_ROOT,'db','app.sqlite'),migrationsDir);
      if(!store.listProjects().some(p=>p.id===id)||store.listProjects().some(p=>p.project_code==='SMOKE-LATER')||
         !fs.existsSync(path.join(DATA_ROOT,'artifacts','smoke-invoice.pdf'))||
         !fs.existsSync(path.join(DATA_ROOT,'vault',imported.relativePath)))
        throw new Error('Native backup restore lost project or attachments');
      checks.push(currentCheck);
      succeeded=true;
    }catch(_error){
      // Log only named synthetic check identifiers. Do not reveal filesystem, OS vault data or customer fields.
      recorder.record('packaged.smoke.'+currentCheck,'fail');
    }
    const report={schema:'tm-native-smoke-v2',passed:checks,failed:succeeded?null:currentCheck,
      source:'packaged-binary',synthetic:true};
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
if(hasSingleInstanceLock){
  app.whenReady().then(run).catch(_error=>{
    recorder.record('startup','fail');
    console.error('Electrical T&M startup failed; see local diagnostics/startup.jsonl (no secrets logged).');
    app.exit(1);
  });
}
let shutdownRequested=false;
app.on('before-quit',event=>{
  if(shutdownRequested)return;
  shutdownRequested=true;
  event.preventDefault();
  void operationQueue.drain().then(()=>{
    store?.close();
    recorder.record('shutdown','pass');
    app.quit();
  }).catch(()=>{
    recorder.record('shutdown','fail');
    app.exit(1);
  });
});
// This single-window Phase 1 proof exits fully on macOS as well: no hidden
// app instance retaining a lock or requiring a separate process cleanup.
app.on('window-all-closed',()=>app.quit());
