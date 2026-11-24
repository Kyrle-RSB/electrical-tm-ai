/** Native packaged Electron smoke, synthetic data only, independent of the Vite dev server.
 * The Windows GUI runtime may not forward stdout, so a private temp receipt is authoritative.
 * Neither this smoke nor its self-test establishes a full P2-AC01..30 acceptance result.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

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
export function validateNativeSmokeReceipt(receipt){
  if(!receipt||typeof receipt!=='object'||receipt.schema!=='tm-native-smoke-v2'||
    receipt.source!=='packaged-binary'||receipt.synthetic!==true||receipt.failed!==null||
    !Array.isArray(receipt.passed)||!validateCockpitFlowReceipt(receipt.cockpitFlow))return false;
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
function runLifecycle(binary){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));
 const nonce=crypto.randomBytes(16).toString('hex');
 let receipts=[],runs=[];
 try{
  fs.writeFileSync(path.join(profile,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{flag:'wx',mode:0o600});
  for(const stage of LIFECYCLE_STAGES){
   const res=spawnSync(binary,['--tm-smoke'],{encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true,
    env:{...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:stage,TM_LIFECYCLE_NONCE:nonce,ELECTRON_ENABLE_LOGGING:'1'}});
   runs.push({stage,exitCode:res.status,signal:res.signal,failed:!!res.error});
   if(res.status!==0||res.error)break;
   receipts.push(JSON.parse(fs.readFileSync(path.join(profile,`lifecycle-${stage}.json`),'utf8')));
  }
  const log=fs.readFileSync(path.join(profile,'diagnostics','startup.jsonl'),'utf8').trim().split('\n').map(x=>JSON.parse(x));
  const shutdowns=log.filter(x=>x.event==='shutdown'&&x.state==='pass').length;
  return {verdict:runs.length===3&&runs.every(r=>r.exitCode===0&&!r.failed)&&validateLifecycleReceipts(receipts,nonce)&&shutdowns===3?'PASS':'FAIL',runs,receipts,shutdowns};
 }catch{return {verdict:'FAIL',runs,receipts,shutdowns:null};}
 finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
// Unit-check the evidence contract even in a non-native build environment.
if(process.argv.includes('--self-test')){
  const cockpitFlow={schema:'tm-cockpit-flow-v1',synthetic:true,interaction:{profileSaved:true,projectCreated:true,projectEdited:true,archiveReopen:true,stableIdentity:true,helpFocusReturn:true},layouts:[[1440,900,'light'],[1440,900,'dark'],[1280,800,'light'],[1280,800,'dark']].map(([width,height,appearance])=>({requestedWidth:width,requestedHeight:height,contentSize:[width,height],zoomFactor:2,appearance,viewportWidth:width/2,viewportHeight:height/2,overflow:false,labels:true}))};
  const valid={schema:'tm-native-smoke-v2',source:'packaged-binary',synthetic:true,
    failed:null,passed:[...NATIVE_REQUIRED_CHECKS],cockpitFlow};
  if(!validateNativeSmokeReceipt(valid)||validateNativeSmokeReceipt({...valid,cockpitFlow:null})||validateNativeSmokeReceipt({...valid,cockpitFlow:{...cockpitFlow,layouts:cockpitFlow.layouts.map(x=>({...x,overflow:true}))}})||validateNativeSmokeReceipt({...valid,failed:'native-os-credential'})||
     validateNativeSmokeReceipt({...valid,passed:valid.passed.slice(0,-1)})||
     validateNativeSmokeReceipt({...valid,source:'mock'})||
     validateNativeSmokeReceipt({...valid,passed:valid.passed.slice().reverse()}))
    throw new Error('Native smoke report contract self-test failed');
  const nonce='0123456789abcdef0123456789abcdef';
  const lifecycle=LIFECYCLE_STAGES.map((stage,i)=>({schema:'tm-lifecycle-v1',synthetic:true,nonce,stage,pid:100+i,projectId:'aafad558-9329-4876-bd71-2de567501979',openedUtc:'2026-11-24T00:00:00.000Z',credential:['stored','read-and-revoked','absent'][i],automaticReload:i!==0}));
  if(!validateLifecycleReceipts(lifecycle,nonce)||validateLifecycleReceipts(lifecycle.slice(0,-1),nonce)||validateLifecycleReceipts(lifecycle.map(x=>({...x,pid:100})),nonce)||validateLifecycleReceipts(lifecycle.map((x,i)=>i===1?{...x,projectId:'different'}:x),nonce)||validateLifecycleReceipts(lifecycle.map((x,i)=>i===2?{...x,credential:'stored'}:x),nonce))throw new Error('Lifecycle evidence contract self-test failed');
  console.log('PASS: five native smoke and five lifecycle receipt-contract cases (NO NATIVE EXECUTION CLAIMED)');
}else if(import.meta.url===pathToFileURL(path.resolve(process.argv[1]||'')).href){
  if(process.platform!=='darwin'&&process.platform!=='win32')
    throw new Error('Native packaged smoke requires macOS/Windows, never Linux mock');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
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
    delete smokeEnv.TM_LIFECYCLE_PROFILE;delete smokeEnv.TM_LIFECYCLE_STAGE;delete smokeEnv.TM_LIFECYCLE_NONCE;
    const result=spawnSync(binary,['--tm-smoke'],{
      encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true,
      env:smokeEnv
    });
    let receipt=null;
    try {receipt=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch{/* Absence is a failure. */}
    const verified=validateNativeSmokeReceipt(receipt);
    const smokeSuccess=result.status===0&&!result.error&&verified;
    const lifecycle=smokeSuccess?runLifecycle(binary):null;
    const success=smokeSuccess&&lifecycle?.verdict==='PASS';
    const binarySha256=crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
    const sanitize=s=>String(s||'').replaceAll(os.homedir(),'<HOME>')
      .replace(/\b(?:sk-ant-|sk-proj-)[A-Za-z0-9_-]{12,}\b/gi,'<REDACTED_SECRET>');
    console.log(JSON.stringify({schema:'tm-native-smoke-runner-v2',platform:process.platform,arch:process.arch,
      binarySha256,exitCode:result.status,signal:result.signal,verdict:success?'PASS':'FAIL',
      checks:receipt?.passed||[],failedCheck:receipt?.failed||(!verified?'missing-or-invalid-report':lifecycle?.verdict==='FAIL'?'full-process-lifecycle':null),
      lifecycle,cockpitFlow:receipt?.cockpitFlow??null,
      note:'PACKAGED, ISOLATED, SYNTHETIC test only. Other Phase 2 acceptance/reviews remain open.',
      diagnosticTail:success?null:sanitize(((result.stdout||'')+'\n'+(result.stderr||'')).slice(-1200)),
      error:result.error?sanitize(result.error.message):null},null,2));
    if(!success)process.exitCode=1;
  } finally {
    fs.rmSync(evidenceDir,{recursive:true,force:true});
  }
}
