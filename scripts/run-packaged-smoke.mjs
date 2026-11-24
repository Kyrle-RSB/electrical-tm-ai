/** Native packaged Electron smoke, synthetic data only, independent of the Vite dev server.
 * The Windows GUI runtime may not forward stdout, so a private temp receipt is authoritative.
 * Neither this smoke nor its self-test establishes a full P2-AC01..30 acceptance result.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

export const NATIVE_REQUIRED_CHECKS=Object.freeze([
  'packaging','renderer-ipc','sqlite-persistence','pdf-create-and-replace',
  'asset-vault','native-os-credential','backup-integrity-restore'
]);
export function validateCockpitFlowReceipt(receipt){
 const flags=['profileSaved','projectCreated','projectEdited','archiveReopen','stableIdentity','helpFocusReturn'];
 if(receipt?.schema!=='tm-cockpit-flow-v1'||receipt.synthetic!==true||flags.some(flag=>receipt.interaction?.[flag]!==true)||!Array.isArray(receipt.layouts)||receipt.layouts.length!==4)return false;
 const expected=[[1440,900,'light'],[1440,900,'dark'],[1280,800,'light'],[1280,800,'dark']];
 return receipt.layouts.every((x,i)=>x.requestedWidth===expected[i][0]&&x.requestedHeight===expected[i][1]&&x.appearance===expected[i][2]&&x.zoomFactor===2&&x.overflow===false&&x.labels===true&&Number.isFinite(x.viewportWidth)&&x.viewportWidth>0&&Number.isFinite(x.viewportHeight)&&x.viewportHeight>0&&Array.isArray(x.contentSize)&&x.contentSize.length===2&&x.contentSize.every(n=>Number.isFinite(n)&&n>0));
}
const SECURITY_METHODS=Object.freeze(['ping','createProject','updateProject','listProjects','listProjectsDetailed','updateProjectDetails','setProjectStatus','getBusinessProfile','updateBusinessProfile','getBusinessLogo','chooseBusinessLogo','removeBusinessLogo','importReceiptImage','saveSyntheticPdf','chooseBackupFolderAndBackUp','getBackupFolder','chooseBackupFolder','backUpToSelectedFolder','chooseBackupAndRestore','storeFakeSecretProof','checkFakeSecretProof','removeFakeSecretProof']);
const MALFORMED_CASES=Object.freeze(['create-missing','create-extra','create-oversize','create-unsafe-code','edit-id','details-extra','status-invalid','profile-extra','profile-required']);
const REQUIRED_CSP="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'";
export function validateRendererSecurityReceipt(receipt){
 if(receipt?.schema!=='tm-renderer-security-v1'||receipt.synthetic!==true||receipt.stateUnchanged!==true||receipt.navigationAttempted!==true||receipt.navigationDenied!==true)return false;
 const {actualPrefs:p,isolation:i,security:s}=receipt;
 if(p?.contextIsolation!==true||p.nodeIntegration!==false||p.sandbox!==true||p.webSecurity!==true||p.webviewTag!==false||i?.requireAbsent!==true||i.processAbsent!==true||i.csp!==REQUIRED_CSP||receipt.expectedCsp!==REQUIRED_CSP)return false;
 if(!Array.isArray(i.bridgeKeys)||i.bridgeKeys.length!==SECURITY_METHODS.length||!SECURITY_METHODS.every(method=>i.bridgeKeys.includes(method)))return false;
 if(!Array.isArray(receipt.foreignResults)||receipt.foreignResults.length!==SECURITY_METHODS.length||!SECURITY_METHODS.every((method,n)=>receipt.foreignResults[n]?.method===method&&receipt.foreignResults[n]?.code==='SECURITY'))return false;
 if(!Array.isArray(receipt.malformedResults)||receipt.malformedResults.length!==MALFORMED_CASES.length||!MALFORMED_CASES.every((id,n)=>receipt.malformedResults[n]?.id===id&&receipt.malformedResults[n]?.code==='VALIDATION'))return false;
 return ['inlineBlocked','evalBlocked','networkBlocked','frameBlocked','popupDenied','permissionDenied'].every(flag=>s?.[flag]===true)&&Array.isArray(s.violations)&&['script-src-elem','connect-src','frame-src'].every(d=>s.violations.includes(d));
}
export function validateNativeSmokeReceipt(receipt){
  if(!receipt||typeof receipt!=='object'||receipt.schema!=='tm-native-smoke-v3'||
    receipt.source!=='packaged-binary'||receipt.synthetic!==true||receipt.failed!==null||
    !Array.isArray(receipt.passed)||!validateCockpitFlowReceipt(receipt.cockpitFlow)||!validateRendererSecurityReceipt(receipt.rendererSecurity))return false;
  if(receipt.passed.length!==NATIVE_REQUIRED_CHECKS.length)return false;
  return NATIVE_REQUIRED_CHECKS.every((check,index)=>receipt.passed[index]===check);
}
export const LIFECYCLE_STAGES=Object.freeze(['seed','reopen','revoked']);
export function validateLifecycleReceipts(receipts,nonce){
 if(!Array.isArray(receipts)||receipts.length!==3||!/^[a-f0-9]{32}$/.test(nonce))return false;
 const expectedCredentials=['stored','read-and-revoked','absent'];
 const first=receipts[0];
 return !!first&&typeof first.projectId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(first.projectId)&&
  typeof first.openedUtc==='string'&&Number.isFinite(Date.parse(first.openedUtc))&&
  new Set(receipts.map(r=>r?.pid)).size===3&&receipts.every((r,i)=>r?.schema==='tm-lifecycle-v1'&&r.synthetic===true&&r.stage===LIFECYCLE_STAGES[i]&&r.nonce===nonce&&Number.isInteger(r.pid)&&r.pid>0&&r.projectId===first.projectId&&r.openedUtc===first.openedUtc&&r.credential===expectedCredentials[i]&&r.automaticReload===(i!==0));
}
/** Actual second-process contention, not a second window in the primary process. */
async function runDuplicateLifecycle(binary,env,profile,nonce){
 const probeEnv={...env,TM_LIFECYCLE_DUPLICATE_PROBE:'1'};delete probeEnv.TM_LIFECYCLE_RENDERER_CRASH_PROBE;
 const primary=spawn(binary,['--tm-smoke'],{stdio:'ignore',windowsHide:true,env:probeEnv});
 let primaryExit=null;
 const settled=new Promise(resolve=>{primary.once('error',()=>resolve({exitCode:null,signal:null,failed:true}));primary.once('close',(exitCode,signal)=>resolve({exitCode,signal,failed:false}));});
 settled.then(value=>{primaryExit=value;});
 let secondary=null;
 try{
  const ready=path.join(profile,'duplicate-ready.json');const deadline=Date.now()+45000;
  while(!fs.existsSync(ready)&&!primaryExit&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  if(!fs.existsSync(ready)||primaryExit)throw new Error('Primary lifecycle did not reach ready state');
  const identity=JSON.parse(fs.readFileSync(ready,'utf8'));
  if(identity.nonce!==nonce||identity.pid!==primary.pid)throw new Error('Duplicate probe primary identity mismatch');
  const attempt=spawnSync(binary,['--tm-smoke'],{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,windowsHide:true,env:probeEnv});
  secondary={exitCode:attempt.status,signal:attempt.signal,failed:!!attempt.error,pid:attempt.pid};
  const exit=await Promise.race([settled,new Promise(resolve=>{const timer=setTimeout(()=>resolve({exitCode:null,signal:null,failed:true}),30000);timer.unref();})]);
  return {primary:exit,secondary,primaryPid:identity.pid,verdict:exit.exitCode===0&&!exit.failed&&secondary.exitCode===0&&!secondary.failed&&secondary.pid!==identity.pid?'PASS':'FAIL'};
 }catch{return {primary:primaryExit,secondary,verdict:'FAIL'};}
 finally{if(primaryExit===null){primary.kill();await settled;}}
}
/** Corrupt only the disposable synthetic migration receipt and prove actual packaged startup fails closed. */
function runStartupDenial(binary,env,profile){
 const dbPath=path.join(profile,'local-data','db','app.sqlite');
 const readState=()=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return {projects:db.prepare('SELECT id,project_code FROM projects ORDER BY id').all(),history:db.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all()};}finally{db.close();}};
 let db=new DatabaseSync(dbPath);try{db.prepare('UPDATE schema_migrations SET checksum=? WHERE version=1').run('0'.repeat(64));}finally{db.close();}
 const before=readState();const logPath=path.join(profile,'diagnostics','startup.jsonl');
 const previous=fs.readFileSync(logPath,'utf8').trim().split('\n').length;
 const attempt=spawnSync(binary,['--tm-smoke'],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true,env});
 const after=readState();const events=fs.readFileSync(logPath,'utf8').trim().split('\n').slice(previous).map(line=>JSON.parse(line));
 const safe=events.every(e=>Object.keys(e).sort().join(',')==='atUtc,event,state'&&/^[a-z][a-z0-9.-]{1,80}$/.test(e.event)&&['begin','pass','fail','info'].includes(e.state));
 const preserved=JSON.stringify(before)===JSON.stringify(after);
 const namedFailure=events.some(e=>e.event==='sqlite.open'&&e.state==='fail')&&events.some(e=>e.event==='startup'&&e.state==='fail');
 return {verdict:attempt.status===1&&!attempt.error&&preserved&&safe&&namedFailure?'PASS':'FAIL',exitCode:attempt.status,logicalStatePreserved:preserved,safeEventFields:safe,namedFailure,events:events.map(({event,state})=>({event,state}))};
}
/** A real native failure must terminate, preserve seeded synthetic data, and emit only safe diagnostic fields. */
function runDiagnosticDenials(binary,env,profile){
 const pii='SYNTHETIC-DIAGNOSTIC-CUSTOMER@example.invalid';
 const credential='TEST-FAKE-DIAGNOSTIC-CREDENTIAL-SENTINEL';
 const dbPath=path.join(profile,'local-data','db','app.sqlite');
 const db=new DatabaseSync(dbPath);try{
  const result=db.prepare('UPDATE projects SET customer_name=? WHERE project_code=?').run(pii,'LIFECYCLE-001');
  if(result.changes!==1)throw new Error('Synthetic diagnostic project absent');
 }finally{db.close();}
 const sentinelPath=path.join(profile,'settings','diagnostic-fake-token.txt');fs.mkdirSync(path.dirname(sentinelPath),{recursive:true,mode:0o700});
 fs.writeFileSync(sentinelPath,credential,{flag:'wx',mode:0o600});
 const state=()=>{const d=new DatabaseSync(dbPath,{readOnly:true});try{return JSON.stringify({projects:d.prepare('SELECT * FROM projects ORDER BY id').all(),history:d.prepare('SELECT * FROM schema_migrations ORDER BY version').all(),sentinel:fs.readFileSync(sentinelPath,'utf8')});}finally{d.close();}};
 const logPath=path.join(profile,'diagnostics','startup.jsonl');const before=state();
 const attempt=(executable,probeEnv,event)=>{
  const previous=fs.readFileSync(logPath,'utf8').trim().split('\n').length;
  const result=spawnSync(executable,['--tm-smoke'],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true,env:probeEnv});
  const log=fs.readFileSync(logPath,'utf8');const events=log.trim().split('\n').slice(previous).map(line=>JSON.parse(line));
  const safeEventFields=events.every(e=>Object.keys(e).sort().join(',')==='atUtc,event,state'&&/^[a-z][a-z0-9.-]{1,80}$/.test(e.event)&&['begin','pass','fail','info'].includes(e.state));
  const sentinelFree=![pii,credential,profile,sentinelPath].some(value=>log.includes(value));
  const namedFailure=events.some(e=>e.event===event&&e.state==='fail');
  const shutdown=events.some(e=>e.event==='shutdown'&&e.state==='pass');
  const logicalStatePreserved=state()===before;
  const verdict=result.status===1&&!result.error&&safeEventFields&&sentinelFree&&namedFailure&&shutdown&&logicalStatePreserved?'PASS':'FAIL';
  return {verdict,exitCode:result.status,spawnFailed:!!result.error,safeEventFields,sentinelFree,namedFailure,shutdown,logicalStatePreserved,events:events.map(({event,state})=>({event,state}))};
 };
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-resource-denial-'));
 let missingResource=null,rendererCrash=null,originalUnchanged=false;
 try{
  const appDir=process.platform==='darwin'?path.resolve(binary,'../../..'):path.dirname(binary);
  const originalResources=process.platform==='darwin'?path.join(appDir,'Contents','Resources'):path.join(appDir,'resources');
  const copiedApp=path.join(fixture,path.basename(appDir));
  const resourceIdentity=()=>JSON.stringify({binary:crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex'),asar:crypto.createHash('sha256').update(fs.readFileSync(path.join(originalResources,'app.asar'))).digest('hex'),migrations:fs.readdirSync(path.join(originalResources,'migrations')).sort().map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(originalResources,'migrations',n))).digest('hex')])});
  const originalIdentity=resourceIdentity();
  fs.cpSync(appDir,copiedApp,{recursive:true,dereference:false,verbatimSymlinks:true,errorOnExist:true,force:false});
  const copiedBinary=path.join(copiedApp,path.relative(appDir,binary));
  const copiedResources=path.join(copiedApp,path.relative(appDir,originalResources));
  fs.renameSync(path.join(copiedResources,'migrations'),path.join(copiedResources,'migrations-synthetic-missing'));
  if(fs.existsSync(path.join(copiedResources,'migrations')))throw new Error('Missing resource fault not injected');
  missingResource=attempt(copiedBinary,env,'sqlite.open');
  originalUnchanged=originalIdentity===resourceIdentity();
  rendererCrash=attempt(binary,{...env,TM_LIFECYCLE_RENDERER_CRASH_PROBE:'1'},'renderer.process');
  originalUnchanged=originalUnchanged&&originalIdentity===resourceIdentity();
 }finally{fs.rmSync(fixture,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 return {schema:'tm-native-diagnostic-denials-v1',synthetic:true,missingResource,rendererCrash,originalUnchanged};
}
export function validateDiagnosticDenials(report){
 return report?.schema==='tm-native-diagnostic-denials-v1'&&report.synthetic===true&&report.originalUnchanged===true&&['missingResource','rendererCrash'].every(k=>{
  const v=report[k];return v?.verdict==='PASS'&&v.exitCode===1&&v.spawnFailed===false&&['safeEventFields','sentinelFree','namedFailure','shutdown','logicalStatePreserved'].every(flag=>v[flag]===true)&&Array.isArray(v.events)&&v.events.some(e=>e.event===(k==='missingResource'?'sqlite.open':'renderer.process')&&e.state==='fail')&&v.events.some(e=>e.event==='shutdown'&&e.state==='pass');
 });
}
export function validateAdversarialLifecycle(lifecycle){
 return lifecycle?.duplicate?.verdict==='PASS'&&lifecycle.duplicate.primary?.exitCode===0&&lifecycle.duplicate.secondary?.exitCode===0&&Number.isInteger(lifecycle.duplicate.primaryPid)&&lifecycle.duplicate.primaryPid>0&&Number.isInteger(lifecycle.duplicate.secondary?.pid)&&lifecycle.duplicate.secondary.pid>0&&lifecycle.duplicate.secondary.pid!==lifecycle.duplicate.primaryPid&&lifecycle.receipts?.[2]?.secondaryLaunches===1&&lifecycle.duplicateEvents===1&&lifecycle.startupDenial?.verdict==='PASS'&&lifecycle.startupDenial.exitCode===1&&lifecycle.startupDenial.logicalStatePreserved===true&&lifecycle.startupDenial.safeEventFields===true&&lifecycle.startupDenial.namedFailure===true;
}
async function runLifecycle(binary){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));
 const nonce=crypto.randomBytes(16).toString('hex');
 let receipts=[],runs=[],duplicate=null,startupDenial=null,diagnosticDenials=null;
 try{
  fs.writeFileSync(path.join(profile,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{flag:'wx',mode:0o600});
  for(const stage of LIFECYCLE_STAGES){
   const env={...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:stage,TM_LIFECYCLE_NONCE:nonce,ELECTRON_ENABLE_LOGGING:'1'};
   delete env.TM_LIFECYCLE_DUPLICATE_PROBE;delete env.TM_LIFECYCLE_RENDERER_CRASH_PROBE;
   if(stage==='revoked'){
    duplicate=await runDuplicateLifecycle(binary,env,profile,nonce);
    runs.push({stage,exitCode:duplicate.primary?.exitCode??null,signal:duplicate.primary?.signal??null,failed:duplicate.verdict!=='PASS'});
    if(duplicate.verdict!=='PASS')break;
   }else{
    const res=spawnSync(binary,['--tm-smoke'],{encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true,env});
    runs.push({stage,exitCode:res.status,signal:res.signal,failed:!!res.error});
    if(res.status!==0||res.error)break;
   }
   receipts.push(JSON.parse(fs.readFileSync(path.join(profile,`lifecycle-${stage}.json`),'utf8')));
  }
  const log=fs.readFileSync(path.join(profile,'diagnostics','startup.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
  const shutdowns=log.filter(x=>x.event==='shutdown'&&x.state==='pass').length;
  const duplicateEvents=log.filter(x=>x.event==='packaged.lifecycle.duplicate'&&x.state==='pass').length;
  if(runs.length===3&&runs.every(r=>r.exitCode===0&&!r.failed)&&validateLifecycleReceipts(receipts,nonce)&&shutdowns===3&&duplicateEvents===1){
   const denialEnv={...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:'revoked',TM_LIFECYCLE_NONCE:nonce,ELECTRON_ENABLE_LOGGING:'1'};delete denialEnv.TM_LIFECYCLE_DUPLICATE_PROBE;delete denialEnv.TM_LIFECYCLE_RENDERER_CRASH_PROBE;
   diagnosticDenials=runDiagnosticDenials(binary,denialEnv,profile);
   startupDenial=runStartupDenial(binary,denialEnv,profile);
  }
  const report={runs,receipts,shutdowns,duplicateEvents,duplicate,startupDenial,diagnosticDenials};
  return {...report,verdict:runs.length===3&&runs.every(r=>r.exitCode===0&&!r.failed)&&validateLifecycleReceipts(receipts,nonce)&&shutdowns===3&&validateAdversarialLifecycle(report)&&validateDiagnosticDenials(diagnosticDenials)?'PASS':'FAIL'};
 }catch{return {verdict:'FAIL',runs,receipts,duplicate,startupDenial,diagnosticDenials,shutdowns:null};}
 finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
const DEV_CSP=REQUIRED_CSP.replace("style-src 'self'","style-src 'self' 'unsafe-inline'").replace("connect-src 'none'","connect-src 'self' ws://localhost:* ws://127.0.0.1:*");
export function validateDevelopmentHmrReceipt(receipt){
 if(receipt?.schema!=='tm-dev-hmr-v1'||receipt.synthetic!==true||receipt.documentPreserved!==true||receipt.loopbackOrigin!==true||!/^[a-f0-9]{32}$/.test(receipt.nonce))return false;
 return ['before','after'].every((key,i)=>{
  const row=receipt[key];return row?.value===(i?'updated-':'initial-')+receipt.nonce&&row.marker===receipt.nonce&&row.title==='Local foundation cockpit'&&row.csp===DEV_CSP&&row.health===true&&row.requireAbsent===true&&row.processAbsent===true;
 });
}
/** Use actual pinned Vite and Electron, actual main/preload/renderer source, and a synthetic
 * CSS dependency that is created and changed only in an ignored disposable fixture. */
async function runDevelopmentHmr(root){
 const desktop=path.join(root,'apps','desktop'),require=createRequire(path.join(desktop,'package.json'));
 const vite=await import(pathToFileURL(require.resolve('vite')).href),electron=require('electron');
 if(vite.version!=='8.3.8'||typeof electron!=='string')throw new Error('Unexpected development toolchain');
 const nonce=crypto.randomBytes(16).toString('hex');
 const evidenceRoot=path.join(root,'.local-evidence');fs.mkdirSync(evidenceRoot,{recursive:true,mode:0o700});
 const work=fs.mkdtempSync(path.join(evidenceRoot,'hmr-fixture-')),profile=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));
 let server,child,settled,exit=null,stage='fixture',receipt=null;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  const appDir=path.join(work,'apps','desktop'),buildDir=path.join(appDir,'.vite','build');fs.mkdirSync(buildDir,{recursive:true});
  fs.copyFileSync(path.join(desktop,'package.json'),path.join(appDir,'package.json'));
  const migrations='packages/persistence-sqlite/src/migrations';fs.cpSync(path.join(root,migrations),path.join(work,migrations),{recursive:true});
  fs.writeFileSync(path.join(profile,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{flag:'wx',mode:0o600});
  const css=path.join(work,'hmr.css'),cssBytes=value=>`:root{--tm-hmr-proof: ${value};}\n`;
  fs.writeFileSync(css,cssBytes('initial-'+nonce),{flag:'wx',mode:0o600});
  const entry=path.join(desktop,'src','renderer','main.tsx'),relative=vite.normalizePath(path.relative(path.dirname(entry),css));
  stage='vite-serve';
  server=await vite.createServer({root:desktop,configFile:path.join(desktop,'vite.renderer.config.ts'),logLevel:'silent',plugins:[{
   name:'fork-b-synthetic-css-hmr',apply:'serve',transform(code,id){if(vite.normalizePath(id.split('?')[0])===vite.normalizePath(entry))return code+'\nimport '+JSON.stringify(relative)+';\n';}
  }],server:{host:'127.0.0.1',port:0,strictPort:true,open:false,watch:{usePolling:true,interval:100}}});
  await server.listen();server.watcher.add(css);
  const address=server.httpServer?.address();if(!address||typeof address==='string'||!Number.isInteger(address.port)||address.port<1)throw new Error('Vite loopback server unavailable');
  const url=`http://127.0.0.1:${address.port}/`;
  for(const target of ['main','preload']){
   stage='build-'+target;
   await vite.build({root:desktop,configFile:path.join(desktop,'vite.'+target+'.config.ts'),logLevel:'silent',define:{MAIN_WINDOW_VITE_DEV_SERVER_URL:JSON.stringify(url)},build:{outDir:buildDir,emptyOutDir:false,target:'node22',minify:false,lib:{entry:path.join(desktop,'src',target,'index.ts'),formats:['cjs'],fileName:()=>target+'.cjs'}}});
  }
  stage='launch';
  const env={...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:'seed',TM_LIFECYCLE_NONCE:nonce};delete env.TM_LIFECYCLE_DUPLICATE_PROBE;delete env.TM_LIFECYCLE_RENDERER_CRASH_PROBE;delete env.TM_SMOKE_REPORT_PATH;delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(electron,[appDir,'--tm-smoke','--tm-dev-hmr-proof'],{env,stdio:'ignore',windowsHide:true});
  settled=new Promise(resolve=>{child.once('error',()=>resolve({exitCode:null,spawnFailed:true}));child.once('close',(exitCode)=>resolve({exitCode,spawnFailed:false}));});settled.then(value=>{exit=value;});
  stage='initial-renderer';const readyPath=path.join(profile,'dev-hmr-ready.json'),resultPath=path.join(profile,'dev-hmr-result.json'),readyDeadline=Date.now()+45000;
  let ready=null;
  while(exit===null&&Date.now()<readyDeadline){
   try{ready=JSON.parse(fs.readFileSync(readyPath,'utf8'));break;}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
   await pause(50);
  }
  if(!ready||exit!==null)throw new Error('Development renderer did not reach initial state');
  if(ready.nonce!==nonce||ready.before?.value!=='initial-'+nonce)throw new Error('Development readiness identity mismatch');
  stage='hot-update';fs.writeFileSync(css,cssBytes('updated-'+nonce));
  const deadline=Date.now()+45000;while(exit===null&&Date.now()<deadline)await pause(50);
  if(exit===null||!fs.existsSync(resultPath))throw new Error('Development HMR did not complete');
  receipt=JSON.parse(fs.readFileSync(resultPath,'utf8'));
  const pass=exit.exitCode===0&&!exit.spawnFailed&&receipt.nonce===nonce&&validateDevelopmentHmrReceipt(receipt);
  return {schema:'tm-dev-hmr-runner-v1',verdict:pass?'PASS':'FAIL',synthetic:true,viteVersion:vite.version,receipt,exit,fixtureOnly:true};
 }catch{
  const log=path.join(profile,'diagnostics','startup.jsonl');let events=[];try{events=fs.readFileSync(log,'utf8').trim().split('\n').map(line=>{const {event,state}=JSON.parse(line);return {event,state};});}catch{/* No safe diagnostic available. */}
  return {schema:'tm-dev-hmr-runner-v1',verdict:'FAIL',synthetic:true,stage,events,receipt,exit,fixtureOnly:true};
 }finally{
  if(child&&exit===null){child.kill();if(settled)await Promise.race([settled,pause(5000)]);if(exit===null){child.kill('SIGKILL');if(settled)await Promise.race([settled,pause(5000)]);}}
  if(server)await server.close();
  // Never remove a fixture while its process could still be using it. A failed cleanup is not a passing proof.
  if(child&&exit===null){process.exitCode=1;console.error('Development proof child did not terminate');child.unref();}
  else{fs.rmSync(work,{recursive:true,force:true,maxRetries:10,retryDelay:100});fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 }
}
// Unit-check the evidence contract even in a non-native build environment.
if(process.argv.includes('--self-test')){
  const cockpitFlow={schema:'tm-cockpit-flow-v1',synthetic:true,interaction:{profileSaved:true,projectCreated:true,projectEdited:true,archiveReopen:true,stableIdentity:true,helpFocusReturn:true},layouts:[[1440,900,'light'],[1440,900,'dark'],[1280,800,'light'],[1280,800,'dark']].map(([width,height,appearance])=>({requestedWidth:width,requestedHeight:height,contentSize:[width,height],zoomFactor:2,appearance,viewportWidth:width/2,viewportHeight:height/2,overflow:false,labels:true}))};
  const rendererSecurity={schema:'tm-renderer-security-v1',synthetic:true,stateUnchanged:true,navigationAttempted:true,navigationDenied:true,actualPrefs:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false},isolation:{requireAbsent:true,processAbsent:true,bridgeKeys:[...SECURITY_METHODS],csp:REQUIRED_CSP},expectedCsp:REQUIRED_CSP,security:{inlineBlocked:true,evalBlocked:true,networkBlocked:true,frameBlocked:true,popupDenied:true,permissionDenied:true,violations:['script-src-elem','script-src','connect-src','frame-src']},foreignResults:SECURITY_METHODS.map(method=>({method,code:'SECURITY'})),malformedResults:MALFORMED_CASES.map(id=>({id,code:'VALIDATION'}))};
  const valid={schema:'tm-native-smoke-v3',source:'packaged-binary',synthetic:true,
    failed:null,passed:[...NATIVE_REQUIRED_CHECKS],cockpitFlow,rendererSecurity};
  if(!validateNativeSmokeReceipt(valid)||validateNativeSmokeReceipt({...valid,rendererSecurity:null})||validateNativeSmokeReceipt({...valid,rendererSecurity:{...rendererSecurity,stateUnchanged:false}})||validateNativeSmokeReceipt({...valid,rendererSecurity:{...rendererSecurity,foreignResults:rendererSecurity.foreignResults.slice(0,-1)}})||validateNativeSmokeReceipt({...valid,rendererSecurity:{...rendererSecurity,malformedResults:rendererSecurity.malformedResults.map(x=>({...x,code:'INTERNAL'}))}})||validateNativeSmokeReceipt({...valid,rendererSecurity:{...rendererSecurity,security:{...rendererSecurity.security,evalBlocked:false}}})||validateNativeSmokeReceipt({...valid,cockpitFlow:null})||validateNativeSmokeReceipt({...valid,cockpitFlow:{...cockpitFlow,layouts:cockpitFlow.layouts.map(x=>({...x,overflow:true}))}})||validateNativeSmokeReceipt({...valid,failed:'native-os-credential'})||
     validateNativeSmokeReceipt({...valid,passed:valid.passed.slice(0,-1)})||
     validateNativeSmokeReceipt({...valid,source:'mock'})||
     validateNativeSmokeReceipt({...valid,passed:valid.passed.slice().reverse()}))
    throw new Error('Native smoke report contract self-test failed');
  const nonce='0123456789abcdef0123456789abcdef';
  const lifecycle=LIFECYCLE_STAGES.map((stage,i)=>({schema:'tm-lifecycle-v1',synthetic:true,nonce,stage,pid:100+i,projectId:'aafad558-9329-4876-bd71-2de567501979',openedUtc:'2026-11-24T00:00:00.000Z',credential:['stored','read-and-revoked','absent'][i],automaticReload:i!==0}));
  if(!validateLifecycleReceipts(lifecycle,nonce)||validateLifecycleReceipts(lifecycle.slice(0,-1),nonce)||validateLifecycleReceipts(lifecycle.map(x=>({...x,pid:100})),nonce)||validateLifecycleReceipts(lifecycle.map((x,i)=>i===1?{...x,projectId:'different'}:x),nonce)||validateLifecycleReceipts(lifecycle.map((x,i)=>i===2?{...x,credential:'stored'}:x),nonce))throw new Error('Lifecycle evidence contract self-test failed');
  const adversarial={duplicate:{verdict:'PASS',primary:{exitCode:0},secondary:{exitCode:0,pid:999},primaryPid:102},receipts:lifecycle.map((x,i)=>({...x,secondaryLaunches:i===2?1:0})),duplicateEvents:1,startupDenial:{verdict:'PASS',exitCode:1,logicalStatePreserved:true,safeEventFields:true,namedFailure:true}};
  if(!validateAdversarialLifecycle(adversarial)||validateAdversarialLifecycle({...adversarial,duplicateEvents:0})||validateAdversarialLifecycle({...adversarial,startupDenial:{...adversarial.startupDenial,logicalStatePreserved:false}}))throw new Error('Adversarial native receipt contract self-test failed');
  const diag=(event)=>({verdict:'PASS',exitCode:1,spawnFailed:false,safeEventFields:true,sentinelFree:true,namedFailure:true,shutdown:true,logicalStatePreserved:true,events:[{event,state:'fail'},{event:'shutdown',state:'pass'}]});
  const denials={schema:'tm-native-diagnostic-denials-v1',synthetic:true,originalUnchanged:true,missingResource:diag('sqlite.open'),rendererCrash:diag('renderer.process')};
  if(!validateDiagnosticDenials(denials)||validateDiagnosticDenials({...denials,originalUnchanged:false})||validateDiagnosticDenials({...denials,rendererCrash:{...denials.rendererCrash,sentinelFree:false}})||validateDiagnosticDenials({...denials,missingResource:{...denials.missingResource,events:[]}}))throw new Error('Diagnostic denial contract self-test failed');
  const devRow=value=>({value,marker:nonce,title:'Local foundation cockpit',csp:DEV_CSP,health:true,requireAbsent:true,processAbsent:true});
  const hmr={schema:'tm-dev-hmr-v1',synthetic:true,nonce,documentPreserved:true,loopbackOrigin:true,before:devRow('initial-'+nonce),after:devRow('updated-'+nonce)};
  if(!validateDevelopmentHmrReceipt(hmr)||validateDevelopmentHmrReceipt({...hmr,documentPreserved:false})||validateDevelopmentHmrReceipt({...hmr,after:hmr.before})||validateDevelopmentHmrReceipt({...hmr,after:{...hmr.after,csp:REQUIRED_CSP}}))throw new Error('Development HMR receipt contract self-test failed');
  console.log('PASS: native smoke, lifecycle and adversarial receipt-contract cases (NO NATIVE EXECUTION CLAIMED)');
}else if(import.meta.url===pathToFileURL(path.resolve(process.argv[1]||'')).href){
  if(process.platform!=='darwin'&&process.platform!=='win32')
    throw new Error('Native packaged smoke requires macOS/Windows, never Linux mock');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  if(process.argv.includes('--dev-hmr')){
   const result=await runDevelopmentHmr(root);console.log(JSON.stringify(result,null,2));if(result.verdict!=='PASS')process.exitCode=1;
  }else{
  const appRoot=path.join(root,'apps/desktop/out');
  let binary=process.env.TM_PACKAGED_EXECUTABLE;
  if(!binary){
    const suffix=process.platform==='darwin'?'darwin-arm64':'win32-x64';
    const target=path.join(appRoot,`ElectricalTMCockpit-${suffix}`);
    binary=process.platform==='darwin'?path.join(target,'ElectricalTMCockpit.app/Contents/MacOS/electrical-tm'):
      path.join(target,'electrical-tm.exe');
  }
  if(!fs.existsSync(binary))throw new Error(`Packaged executable not found (build required): ${binary}`);
  const evidenceDir=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-smoke-run-'));
  const evidencePath=path.join(evidenceDir,'result.json');
  try {
    const smokeEnv={...process.env,ELECTRON_ENABLE_LOGGING:'1',TM_SMOKE_REPORT_PATH:evidencePath};
    delete smokeEnv.TM_LIFECYCLE_PROFILE;delete smokeEnv.TM_LIFECYCLE_STAGE;delete smokeEnv.TM_LIFECYCLE_NONCE;delete smokeEnv.TM_LIFECYCLE_DUPLICATE_PROBE;delete smokeEnv.TM_LIFECYCLE_RENDERER_CRASH_PROBE;
    const result=spawnSync(binary,['--tm-smoke'],{
      encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true,
      env:smokeEnv
    });
    let receipt=null;
    try {receipt=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch{/* Absence is a failure. */}
    const verified=validateNativeSmokeReceipt(receipt);
    const smokeSuccess=result.status===0&&!result.error&&verified;
    const lifecycle=smokeSuccess?await runLifecycle(binary):null;
    const success=smokeSuccess&&lifecycle?.verdict==='PASS';
    const binarySha256=crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
    const sanitize=s=>String(s||'').replaceAll(os.homedir(),'<HOME>')
      .replace(/\b(?:sk-ant-|sk-proj-)[A-Za-z0-9_-]{12,}\b/gi,'<REDACTED_SECRET>');
    console.log(JSON.stringify({schema:'tm-native-smoke-runner-v3',platform:process.platform,arch:process.arch,
      binarySha256,exitCode:result.status,signal:result.signal,verdict:success?'PASS':'FAIL',
      checks:receipt?.passed||[],failedCheck:receipt?.failed||(!verified?'missing-or-invalid-report':lifecycle?.verdict==='FAIL'?'full-process-lifecycle':null),
      lifecycle,cockpitFlow:receipt?.cockpitFlow??null,rendererSecurity:receipt?.rendererSecurity??null,
      note:'PACKAGED, ISOLATED, SYNTHETIC test only. Other Phase 2 acceptance/reviews remain open.',
      diagnosticTail:success?null:sanitize(((result.stdout||'')+'\n'+(result.stderr||'')).slice(-1200)),
      error:result.error?sanitize(result.error.message):null},null,2));
    if(!success)process.exitCode=1;
  } finally {
    fs.rmSync(evidenceDir,{recursive:true,force:true});
  }
}
}
