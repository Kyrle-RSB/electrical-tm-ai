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
export function validateNativeSmokeReceipt(receipt){
  if(!receipt||typeof receipt!=='object'||receipt.schema!=='tm-native-smoke-v2'||
    receipt.source!=='packaged-binary'||receipt.synthetic!==true||receipt.failed!==null||
    !Array.isArray(receipt.passed))return false;
  if(receipt.passed.length!==NATIVE_REQUIRED_CHECKS.length)return false;
  return NATIVE_REQUIRED_CHECKS.every((check,index)=>receipt.passed[index]===check);
}
// Unit-check the evidence contract even in a non-native build environment.
if(process.argv.includes('--self-test')){
  const valid={schema:'tm-native-smoke-v2',source:'packaged-binary',synthetic:true,
    failed:null,passed:[...NATIVE_REQUIRED_CHECKS]};
  if(!validateNativeSmokeReceipt(valid)||validateNativeSmokeReceipt({...valid,failed:'native-os-credential'})||
     validateNativeSmokeReceipt({...valid,passed:valid.passed.slice(0,-1)})||
     validateNativeSmokeReceipt({...valid,source:'mock'})||
     validateNativeSmokeReceipt({...valid,passed:valid.passed.slice().reverse()}))
    throw new Error('Native smoke report contract self-test failed');
  console.log('PASS: five native smoke report-contract cases (NO NATIVE EXECUTION CLAIMED)');
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
    const result=spawnSync(binary,['--tm-smoke'],{
      encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true,
      env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',TM_SMOKE_REPORT_PATH:evidencePath}
    });
    let receipt=null;
    try {receipt=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch{/* Absence is a failure. */}
    const verified=validateNativeSmokeReceipt(receipt);
    const success=result.status===0&&!result.error&&verified;
    const binarySha256=crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
    const sanitize=s=>String(s||'').replaceAll(os.homedir(),'<HOME>')
      .replace(/\b(?:sk-ant-|sk-proj-)[A-Za-z0-9_-]{12,}\b/gi,'<REDACTED_SECRET>');
    console.log(JSON.stringify({schema:'tm-native-smoke-runner-v2',platform:process.platform,arch:process.arch,
      binarySha256,exitCode:result.status,signal:result.signal,verdict:success?'PASS':'FAIL',
      checks:receipt?.passed||[],failedCheck:receipt?.failed||(!verified?'missing-or-invalid-report':null),
      note:'PACKAGED, ISOLATED, SYNTHETIC test only. Other Phase 2 acceptance/reviews remain open.',
      diagnosticTail:success?null:sanitize(((result.stdout||'')+'\n'+(result.stderr||'')).slice(-1200)),
      error:result.error?sanitize(result.error.message):null},null,2));
    if(!success)process.exitCode=1;
  } finally {
    fs.rmSync(evidenceDir,{recursive:true,force:true});
  }
}
