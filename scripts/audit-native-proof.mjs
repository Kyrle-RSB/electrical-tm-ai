/** Check receipt integrity. A PASS here means the evidence package is intact, NOT that the app passes Phase 2. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {validateLifecycleReceipts,NATIVE_REQUIRED_CHECKS,validateCockpitFlowReceipt,validateAdversarialLifecycle,validateRendererSecurityReceipt,validateDiagnosticDenials,validateDevelopmentHmrReceipt} from './run-packaged-smoke.mjs';
const dir=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(dir)){console.error('Usage: node scripts/audit-native-proof.mjs <extracted-evidence-directory>');process.exit(2)}
const fail=(reason)=>{console.error(JSON.stringify({integrity:'FAIL',reason}));process.exit(1)};
const sha=(x)=>crypto.createHash('sha256').update(x).digest('hex');
const file=(name)=>{const p=path.resolve(dir,name);if(!p.startsWith(dir+path.sep))fail('Bad relative path');if(!fs.existsSync(p))fail('Missing '+name);return fs.readFileSync(p)};
try{
 const man=JSON.parse(file('MANIFEST.json').toString());
 if(!Array.isArray(man.files))fail('Manifest missing file inventory');
 for(const x of man.files){if(typeof x.path!=='string'||!x.sha256||sha(file(x.path))!==x.sha256)fail('Mismatched '+x.path)}
 const manifestHash=sha(man.files.map(x=>x.path+' '+x.sha256).join('\n'));
 if(manifestHash!==man.manifestSha256)fail('Manifest checksum mismatch');
 const r=JSON.parse(file('result.json').toString());
 if(r.formalAcceptanceVerdict!=='UNASSESSED')fail('Unexpected formal acceptance claim');
 if(typeof r.testedSourceFingerprint!=='string'||r.testedSourceFingerprint.length!==64)fail('No source fingerprint');
 if(!Array.isArray(r.steps)||!r.steps.length)fail('No executed steps');
 if(!['NATIVE_AUTOMATED_SUBSET_PASS','NATIVE_AUTOMATED_SUBSET_FAIL'].includes(r.verdict))fail('Invalid native subset result');
 const expectedSteps=['install','local-tests','desktop-typecheck','source-quality','smoke-contract','module-audit','packaged-build','native-packaged-smoke'];
 if(r.contractVersion==='8')expectedSteps.push('native-dev-hmr');
 if(r.verdict==='NATIVE_AUTOMATED_SUBSET_PASS'&&
  (r.steps.length!==expectedSteps.length||r.steps.some((x,i)=>x.status!=='PASS'||x.id!==expectedSteps[i])))
  fail('Unsupported PASS conclusion');
 if(['3','4','5','6','7','8'].includes(r.contractVersion)){
  const provenance=JSON.parse(file('source-provenance.json').toString());
  if(r.sourceProvenance?.status!==provenance.status)fail('Source provenance status mismatch');
  if(r.verdict==='NATIVE_AUTOMATED_SUBSET_PASS'&&r.sourceAfterVerified!==true)fail('Source drift was not excluded');
  if(provenance.status==='CLEAN_GIT_CHECKOUT'){
   if(!/^[a-f0-9]{40}$/.test(provenance.commit)||!/^[a-f0-9]{40}$/.test(provenance.tree)||!Array.isArray(provenance.files)||!provenance.files.length)fail('Incomplete Git provenance');
   if(provenance.files.some(x=>!['100644','100755'].includes(x.mode)||!(/^[a-f0-9]{40}$/.test(x.blob))||!(/^[a-f0-9]{64}$/.test(x.rawSha256)))||new Set(provenance.files.map(x=>x.path)).size!==provenance.files.length)fail('Invalid tracked manifest entry');
   const canonical=sha(JSON.stringify(provenance.files.map(({path,mode,blob})=>({path,mode,blob}))));
   if(canonical!==provenance.manifestSha256||r.sourceProvenance.commit!==provenance.commit||r.sourceProvenance.tree!==provenance.tree||r.sourceProvenance.manifestSha256!==canonical)fail('Git manifest identity mismatch');
  }else if(provenance.status!=='ARCHIVE_ONLY_NO_GIT_PROOF')fail('Unknown source provenance');
  if(r.verdict==='NATIVE_AUTOMATED_SUBSET_PASS'){
   const smoke=JSON.parse(file('logs/native-packaged-smoke.log').toString());
   if(['4','5','6','7','8'].includes(r.contractVersion)&&!validateCockpitFlowReceipt(smoke.cockpitFlow))fail('Packaged cockpit flow evidence missing');
   if(['5','6','7','8'].includes(r.contractVersion)&&!validateAdversarialLifecycle(smoke.lifecycle))fail('Adversarial native lifecycle evidence missing');
   if(['6','7','8'].includes(r.contractVersion)&&!validateRendererSecurityReceipt(smoke.rendererSecurity))fail('Native renderer security evidence missing');
   if(['7','8'].includes(r.contractVersion)&&!validateDiagnosticDenials(smoke.lifecycle?.diagnosticDenials))fail('Native diagnostic denial evidence missing');
   if(r.contractVersion==='8'){const hmr=JSON.parse(file('logs/native-dev-hmr.log').toString());if(hmr.verdict!=='PASS'||hmr.synthetic!==true||hmr.viteVersion!=='8.3.8'||hmr.fixtureOnly!==true||hmr.exit?.exitCode!==0||hmr.exit?.spawnFailed||!validateDevelopmentHmrReceipt(hmr.receipt))fail('Actual development HMR proof missing');}
   if(smoke.verdict!=='PASS'||JSON.stringify(smoke.checks)!==JSON.stringify(NATIVE_REQUIRED_CHECKS)||smoke.lifecycle?.verdict!=='PASS'||smoke.lifecycle?.shutdowns!==3||!validateLifecycleReceipts(smoke.lifecycle?.receipts,smoke.lifecycle?.receipts?.[0]?.nonce??'')||smoke.lifecycle?.runs?.length!==3||smoke.lifecycle.runs.some(x=>x.exitCode!==0||x.failed))fail('Full process lifecycle proof missing');
  }
 }
 console.log(JSON.stringify({integrity:'PASS',filesVerified:man.files.length,nativeSubsetVerdict:r.verdict,formalAcceptance:'UNASSESSED',sourceFingerprint:r.testedSourceFingerprint},null,2));
}catch(e){fail(e.message)}
