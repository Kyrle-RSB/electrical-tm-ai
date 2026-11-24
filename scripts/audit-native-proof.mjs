/** Check receipt integrity. A PASS here means the evidence package is intact, NOT that the app passes Phase 2. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
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
 if(r.verdict==='NATIVE_AUTOMATED_SUBSET_PASS'&&
  (r.steps.length!==expectedSteps.length||r.steps.some((x,i)=>x.status!=='PASS'||x.id!==expectedSteps[i])))
  fail('Unsupported PASS conclusion');
 console.log(JSON.stringify({integrity:'PASS',filesVerified:man.files.length,nativeSubsetVerdict:r.verdict,formalAcceptance:'UNASSESSED',sourceFingerprint:r.testedSourceFingerprint},null,2));
}catch(e){fail(e.message)}
