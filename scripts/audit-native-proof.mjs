/** Check receipt integrity. A PASS here means the evidence package is intact, NOT that the app passes Phase 2. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {validateLifecycleReceipts,NATIVE_REQUIRED_CHECKS,validateCockpitFlowReceipt,validateAdversarialLifecycle,validateRendererSecurityReceipt,validateDiagnosticDenials,parseDevelopmentHmrRunnerLog,validateRawIpcProof,validatePortIsolation,validateInvalidRendererDenial,validateStartupReadiness,validateInterruptedRestoreDenial,validateExtendedCockpitReceipt,validateCockpitPng,validateAbnormalLifecycle,validateBackupCoverage} from './run-packaged-smoke.mjs';
const sha=(x)=>crypto.createHash('sha256').update(x).digest('hex');
const hex=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const safePath=(x)=>typeof x==='string'&&x.length>0&&x.length<=1024&&x.split('/').every(p=>p!==''&&p!=='.'&&p!=='..'&&!/[\\:\x00-\x1f]/.test(p));
const requireCheck=(ok,reason)=>{if(!ok)throw new Error(reason);};
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
function reader(dir){
 const root=fs.realpathSync(dir);requireCheck(!fs.lstatSync(dir).isSymbolicLink(),'Linked evidence root');
 return name=>{
  requireCheck(safePath(name),'Bad relative path');const p=path.join(root,...name.split('/'));
  const parent=path.dirname(p);requireCheck(fs.realpathSync(parent)===parent,'Linked evidence directory');
  const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
  try{
   const initial=fs.fstatSync(fd);requireCheck(initial.isFile()&&initial.nlink===1&&initial.size<=16*1024*1024,'Unsafe evidence file');
   const named=()=>{const n=fs.lstatSync(p);return n.isFile()&&!n.isSymbolicLink()&&n.nlink===1&&same(initial,n)&&same(initial,fs.fstatSync(fd))&&fs.realpathSync(parent)===parent;};
   requireCheck(named(),'Changed evidence identity');const bytes=Buffer.alloc(initial.size);let offset=0;
   while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);requireCheck(n>0,'Short evidence read');offset+=n;}
   requireCheck(named(),'Changed evidence identity');return bytes;
  }finally{fs.closeSync(fd);}
 };
}
function inventory(dir,prefix=''){
 const paths=[];for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=prefix+item.name;requireCheck(safePath(rel),'Bad inventory path');
  if(item.isDirectory())paths.push(...inventory(path.join(dir,item.name),rel+'/'));
  else{requireCheck(item.isFile(),'Nonregular evidence inventory object');if(rel!=='MANIFEST.json')paths.push(rel);}
 }return paths;
}
function validateManifest(man,actual,file){
 requireCheck(Array.isArray(man.files)&&man.files.length>0&&man.files.length<=256,'Manifest missing or excessive inventory');
 const names=new Set();for(const x of man.files){requireCheck(safePath(x?.path)&&x.path!=='MANIFEST.json'&&hex(x.sha256,64)&&!names.has(x.path),'Invalid or duplicate manifest entry');names.add(x.path);}
 requireCheck(actual.length===names.size&&actual.every(p=>names.has(p)),'Manifest inventory not complete');
 requireCheck(sha(man.files.map(x=>x.path+' '+x.sha256).join('\n'))===man.manifestSha256,'Manifest checksum mismatch');
 for(const x of man.files)requireCheck(sha(file(x.path))===x.sha256,'Mismatched '+x.path);
 return names;
}
const expectedFor=v=>['install','local-tests','desktop-typecheck','source-quality','smoke-contract','module-audit','packaged-build','native-packaged-smoke',...(['8','9','10','11','12'].includes(v)?['native-dev-hmr']:[])];
function validateRegression(log){
 const counts={};for(const line of log.split(/\r?\n/)){
  const m=/^(?:ℹ|#) (tests|pass|fail|cancelled|skipped|todo) (\d+)$/.exec(line.trim());if(!m)continue;
  requireCheck(!Object.hasOwn(counts,m[1]),'Ambiguous regression summary');counts[m[1]]=Number(m[2]);
 }
 requireCheck(Number.isSafeInteger(counts.tests)&&counts.tests>0&&counts.pass===counts.tests&&['fail','cancelled','skipped','todo'].every(k=>counts[k]===0),'Incomplete or nonpassing regression summary');
}
function validateReport(r,names,file){
 requireCheck(['2','3','4','5','6','7','8','9','10','11','12'].includes(r.contractVersion),'Unknown native contract');
 requireCheck(r.kind==='fork-b-native-proof'&&r.formalAcceptanceVerdict==='UNASSESSED'&&hex(r.testedSourceFingerprint,64),'Invalid evidence identity or formal acceptance claim');
 requireCheck(['NATIVE_AUTOMATED_SUBSET_PASS','NATIVE_AUTOMATED_SUBSET_FAIL'].includes(r.verdict),'Invalid native subset result');
 const expected=expectedFor(r.contractVersion),pass=r.verdict==='NATIVE_AUTOMATED_SUBSET_PASS';
 requireCheck(Array.isArray(r.steps)&&r.steps.length>0&&r.steps.length<=expected.length,'Invalid executed steps');
 for(const [i,x] of r.steps.entries())requireCheck(x.id===expected[i]&&['PASS','FAIL'].includes(x.status)&&x.log==='logs/'+x.id+'.log'&&names.has(x.log)&&(x.status!=='PASS'||x.exitCode===0&&x.signal===null&&x.note===null)&&(i===r.steps.length-1||x.status==='PASS'),'Missing or contradictory step '+i);
 requireCheck(!pass||r.steps.length===expected.length&&r.steps.every(x=>x.status==='PASS'),'Unsupported PASS conclusion');
 if(r.contractVersion!=='12')return;
 for(const name of ['host.json','result.json','source-provenance.json','manual-evidence-template.json','SHARE_SAFELY.md'])requireCheck(names.has(name),'Missing required receipt '+name);
 const host=JSON.parse(file('host.json').toString());
 requireCheck(Object.keys(host).length===Object.keys(r.host??{}).length&&Object.entries(host).every(([k,v])=>r.host[k]===v)&&host.sourceFingerprint===r.testedSourceFingerprint&&(host.platform==='darwin'&&host.architecture==='arm64'||host.platform==='win32'&&host.architecture==='x64')&&/^v24\.\d+\.\d+$/.test(host.node)&&host.pnpmPinned==='pnpm@12.21.0','Host receipt mismatch');
 requireCheck(r.manualTests==='NOT_EXECUTED_BY_AUTOMATION'&&r.independentReview==='NOT_EXECUTED_BY_AUTOMATION','Automation cannot claim manual review');
 const manual=JSON.parse(file('manual-evidence-template.json').toString());requireCheck(manual.hostFingerprint===r.testedSourceFingerprint&&Array.isArray(manual.scenarios)&&manual.scenarios.length===0&&manual.reviewer===null,'Unexpected manual evidence assertion');
 if(pass){
  validateRegression(file('logs/local-tests.log').toString());
  const artifacts=r.artifactHashes;
  requireCheck(Array.isArray(artifacts)&&artifacts.length>0&&new Set(artifacts.map(x=>x.name)).size===artifacts.length&&artifacts.every(x=>safePath(x.name)&&x.name.startsWith('apps/desktop/out/make/')&&Number.isSafeInteger(x.bytes)&&x.bytes>0&&hex(x.sha256,64))&&artifacts.some(x=>host.platform==='darwin'?x.name.includes('/darwin/arm64/'):x.name.includes('/win32/x64/')),'Missing or invalid native artifact identity');
 }
}
function selfTest(){
 const bytes=Buffer.from('synthetic test bytes'),entry={path:'result.json',sha256:sha(bytes)},man={files:[entry],manifestSha256:sha(entry.path+' '+entry.sha256)};
 const reject=fn=>{let refused=false;try{fn();}catch{refused=true;}requireCheck(refused,'Invalid synthetic audit case accepted');};
 validateManifest(man,['result.json'],()=>bytes);
 reject(()=>validateManifest(man,[],()=>bytes));reject(()=>validateManifest(man,['result.json','extra'],()=>bytes));reject(()=>validateManifest({...man,files:[entry,entry]},['result.json'],()=>bytes));reject(()=>validateManifest(man,['result.json'],()=>Buffer.from('changed')));
 const summary=['tests 10','pass 10','fail 0','cancelled 0','skipped 0','todo 0'].map(s=>'ℹ '+s).join('\n');validateRegression(summary);reject(()=>validateRegression(summary.replace('skipped 0','skipped 1')));reject(()=>validateRegression(summary.replace('pass 10','pass 9')));reject(()=>validateRegression(summary+'\nℹ tests 10'));reject(()=>validateRegression(''));
 const host={platform:'darwin',architecture:'arm64',node:'v24.22.3',pnpmPinned:'pnpm@12.21.0',sourceFingerprint:'a'.repeat(64)};
 const r={kind:'fork-b-native-proof',contractVersion:'12',formalAcceptanceVerdict:'UNASSESSED',testedSourceFingerprint:host.sourceFingerprint,host,verdict:'NATIVE_AUTOMATED_SUBSET_PASS',steps:expectedFor('12').map(id=>({id,status:'PASS',exitCode:0,signal:null,note:null,log:'logs/'+id+'.log'})),artifactHashes:[{name:'apps/desktop/out/make/zip/darwin/arm64/test.zip',bytes:100,sha256:'b'.repeat(64)}],manualTests:'NOT_EXECUTED_BY_AUTOMATION',independentReview:'NOT_EXECUTED_BY_AUTOMATION'};
 const names=new Set(['host.json','result.json','source-provenance.json','manual-evidence-template.json','SHARE_SAFELY.md',...r.steps.map(x=>x.log)]);
 const file=name=>Buffer.from(name==='host.json'?JSON.stringify(host):name==='manual-evidence-template.json'?JSON.stringify({hostFingerprint:host.sourceFingerprint,scenarios:[],reviewer:null}):summary);
 validateReport(r,names,file);reject(()=>validateReport({...r,contractVersion:'999'},names,file));reject(()=>validateReport({...r,steps:r.steps.map((x,i)=>i===1?{...x,exitCode:1}:x)},names,file));reject(()=>validateReport(r,new Set([...names].filter(x=>x!=='logs/local-tests.log')),file));reject(()=>validateReport({...r,artifactHashes:[]},names,file));reject(()=>validateReport({...r,host:{...host,architecture:'x64'}},names,file));reject(()=>validateReport({...r,independentReview:'PASS'},names,file));
 console.log('PASS: synthetic audit admission tests (not native execution evidence)');
}
if(process.argv.includes('--self-test')){selfTest();process.exit(0);}
const dir=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(dir)){console.error('Usage: node scripts/audit-native-proof.mjs <extracted-evidence-directory>');process.exit(2);}
const fail=(reason)=>{console.error(JSON.stringify({integrity:'FAIL',reason}));process.exit(1);};
try{
 const file=reader(dir),man=JSON.parse(file('MANIFEST.json').toString());
 const names=validateManifest(man,inventory(dir),file);
 const r=JSON.parse(file('result.json').toString());
 validateReport(r,names,file);
 if(['3','4','5','6','7','8','9','10','11','12'].includes(r.contractVersion)){
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
   if(['4','5','6','7','8','9','10','11','12'].includes(r.contractVersion)&&!validateCockpitFlowReceipt(smoke.cockpitFlow))fail('Packaged cockpit flow evidence missing');
   if(['5','6','7','8','9','10','11','12'].includes(r.contractVersion)&&!validateAdversarialLifecycle(smoke.lifecycle))fail('Adversarial native lifecycle evidence missing');
   if(['6','7','8','9','10','11','12'].includes(r.contractVersion)&&!validateRendererSecurityReceipt(smoke.rendererSecurity))fail('Native renderer security evidence missing');
   if(['7','8','9','10','11','12'].includes(r.contractVersion)&&!validateDiagnosticDenials(smoke.lifecycle?.diagnosticDenials))fail('Native diagnostic denial evidence missing');
   if(['8','9','10','11','12'].includes(r.contractVersion))parseDevelopmentHmrRunnerLog(file('logs/native-dev-hmr.log').toString());
   if(['9','10','11','12'].includes(r.contractVersion)&&(!validatePortIsolation(smoke.portIsolation)||smoke.rawIpc?.exitCode!==0||smoke.rawIpc?.spawnFailed!==false||!validateRawIpcProof(smoke.rawIpc?.receipt)||!validateInvalidRendererDenial(smoke.lifecycle?.diagnosticDenials)))fail('Actual raw IPC, port isolation or invalid renderer evidence missing');
   if(['10','11','12'].includes(r.contractVersion)&&(!validateStartupReadiness(smoke.startupReadiness)||!validateInterruptedRestoreDenial(smoke.lifecycle?.interruptedRestore)))fail('Actual readiness or interrupted restore denial missing');
   if(['11','12'].includes(r.contractVersion)){
    if(!validateExtendedCockpitReceipt(smoke.cockpitFlow))fail('Extended cockpit evidence missing');
    for(const layout of smoke.cockpitFlow.layouts){const shot=layout.screenshot,p='screenshots/'+shot.name;if(!man.files.some(x=>x.path===p&&x.sha256===shot.sha256)||!validateCockpitPng(file(p),shot))fail('Screenshot receipt mismatch '+p);}
   }
   if(r.contractVersion==='12'&&(!validateAbnormalLifecycle(smoke.lifecycle)||!validateBackupCoverage(smoke.backupCoverage)||!file('logs/install.log').toString().includes('Cold-cache proof: newly created empty')))fail('Extended lifecycle, backup or cold cache receipt missing');
   if(smoke.verdict!=='PASS'||JSON.stringify(smoke.checks)!==JSON.stringify(NATIVE_REQUIRED_CHECKS)||smoke.lifecycle?.verdict!=='PASS'||smoke.lifecycle?.shutdowns!==3||!validateLifecycleReceipts(smoke.lifecycle?.receipts,smoke.lifecycle?.receipts?.[0]?.nonce??'')||smoke.lifecycle?.runs?.length!==3||smoke.lifecycle.runs.some(x=>x.exitCode!==0||x.failed))fail('Full process lifecycle proof missing');
  }
 }
 console.log(JSON.stringify({integrity:'PASS',filesVerified:man.files.length,nativeSubsetVerdict:r.verdict,formalAcceptance:'UNASSESSED',sourceFingerprint:r.testedSourceFingerprint},null,2));
}catch(e){fail(e.message)}
