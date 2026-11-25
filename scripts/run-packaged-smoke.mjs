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
import {createServer} from 'node:net';

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
/** Contract 11 extends, never replaces, the historical receipt checks. */
export function validateExtendedCockpitReceipt(receipt){
 if(!validateCockpitFlowReceipt(receipt)||receipt.firstRunEmpty!==true||receipt.statusReasonsPersisted!==true||receipt.themeStatePreserved!==true)return false;
 const flags=['duplicateDenied','missingCustomerDenied','taxLengthDenied','cancelEdit','cancelStatus','longContent','disabledReason'];
 if(flags.some(flag=>receipt.interaction?.[flag]!==true))return false;
 return receipt.layouts.every(x=>{
  const shot=x.screenshot;
  return x.contentSize[0]===x.requestedWidth&&x.contentSize[1]===x.requestedHeight&&Number.isInteger(x.textChecks)&&x.textChecks>=20&&Number.isFinite(x.minTextRatio)&&x.minTextRatio>=4.5&&Number.isFinite(x.minLargeRatio)&&x.minLargeRatio>=3&&Number.isFinite(x.focusRatio)&&x.focusRatio>=3&&x.focusVisible===true&&shot?.name===`cockpit-${x.requestedWidth}x${x.requestedHeight}-${x.appearance}.png`&&Number.isInteger(shot.bytes)&&shot.bytes>=1024&&shot.bytes<=10*1024*1024&&/^[a-f0-9]{64}$/.test(shot.sha256)&&Number.isInteger(shot.width)&&shot.width>=x.requestedWidth&&shot.width<=4*x.requestedWidth&&Number.isInteger(shot.height)&&shot.height>=x.requestedHeight&&shot.height<=4*x.requestedHeight&&Math.abs(shot.width*x.requestedHeight-shot.height*x.requestedWidth)<=Math.max(x.requestedWidth,x.requestedHeight);
 });
}
export function validateCockpitPng(bytes,shot){
 return Buffer.isBuffer(bytes)&&bytes.length===shot.bytes&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString()==='IHDR'&&bytes.readUInt32BE(16)===shot.width&&bytes.readUInt32BE(20)===shot.height&&crypto.createHash('sha256').update(bytes).digest('hex')===shot.sha256;
}
const SECURITY_METHODS=Object.freeze(['ping','createProject','updateProject','listProjects','listProjectsDetailed','updateProjectDetails','setProjectStatus','getBusinessProfile','updateBusinessProfile','getBusinessLogo','chooseBusinessLogo','removeBusinessLogo','importReceiptImage','saveSyntheticPdf','chooseBackupFolderAndBackUp','getBackupFolder','chooseBackupFolder','backUpToSelectedFolder','chooseBackupAndRestore','storeFakeSecretProof','checkFakeSecretProof','removeFakeSecretProof']);
const SECURITY_METHODS_V2=Object.freeze(SECURITY_METHODS.flatMap(method=>method==='chooseBackupAndRestore'?['listVerifiedBackups',method]:[method]));
const MALFORMED_CASES=Object.freeze(['create-missing','create-extra','create-oversize','create-unsafe-code','edit-id','details-extra','status-invalid','profile-extra','profile-required']);
const REQUIRED_CSP="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'";
export function validateRendererSecurityReceipt(receipt,version=2){
 const methods=version===1?SECURITY_METHODS:SECURITY_METHODS_V2;
 if(receipt?.schema!==`tm-renderer-security-v${version}`||receipt.synthetic!==true||receipt.stateUnchanged!==true||receipt.navigationAttempted!==true||receipt.navigationDenied!==true)return false;
 const {actualPrefs:p,isolation:i,security:s}=receipt;
 if(p?.contextIsolation!==true||p.nodeIntegration!==false||p.sandbox!==true||p.webSecurity!==true||p.webviewTag!==false||i?.requireAbsent!==true||i.processAbsent!==true||i.csp!==REQUIRED_CSP||receipt.expectedCsp!==REQUIRED_CSP)return false;
 if(!Array.isArray(i.bridgeKeys)||i.bridgeKeys.length!==methods.length||!methods.every(method=>i.bridgeKeys.includes(method)))return false;
 if(!Array.isArray(receipt.foreignResults)||receipt.foreignResults.length!==methods.length||!methods.every((method,n)=>receipt.foreignResults[n]?.method===method&&receipt.foreignResults[n]?.code==='SECURITY'))return false;
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
const RAW_CHANNELS=Object.freeze(['health.ping','projects.create','projects.edit','projects.list','projects.listDetailed','projects.updateDetails','projects.setStatus','business.get','business.update','business.logo.get','business.logo.choose','business.logo.remove','documents.importImage','documents.renderInvoiceProof','backup.create','backup.getLocation','backup.chooseLocation','backup.createInSelectedFolder','backup.restore','secrets.probeStoreFake','secrets.probeCheckFake','secrets.probeRemoveFake']);
const RAW_CHANNELS_V2=Object.freeze(RAW_CHANNELS.flatMap(channel=>channel==='backup.restore'?['backup.listVerified',channel]:[channel]));
const RAW_CASES=Object.freeze([['valid-ping','OK'],['replayed-ping','SECURITY'],['wrong-version','VALIDATION'],['bad-envelope','VALIDATION'],['missing-argument','VALIDATION'],['extra-argument','VALIDATION'],['oversized','VALIDATION'],['cyclic','VALIDATION'],['invalid-mutation','VALIDATION'],['replayed-altered-mutation','SECURITY'],['unknown-channel','UNREGISTERED']]);
export function validateRawIpcProof(proof,version=2){
 if(proof?.schema!==`tm-native-raw-ipc-v${version}`||proof.synthetic!==true||proof.source!=='packaged-binary'||proof.stateUnchanged!==true)return false;
 const match=(frame,url,main,cases)=>frame?.url===url&&frame.main===main&&Array.isArray(frame.results)&&frame.results.length===cases.length&&cases.every(([name,code],i)=>{
  const result=frame.results[i];return result?.name===name&&result.code===code&&result.correlated===(code!=='UNREGISTERED')&&(code!=='OK'||result.health===true);
 });
 const denied=(version===1?RAW_CHANNELS:RAW_CHANNELS_V2).map(channel=>[channel,'SECURITY']);
 return match(proof.trusted,'tmapp://app/raw-ipc-proof.html',true,RAW_CASES)&&Array.isArray(proof.children)&&proof.children.length===2&&match(proof.children[0],'tmapp://app/raw-frame.html',false,denied)&&match(proof.children[1],'tmapp://raw-fixture/raw-frame.html',false,denied)&&match(proof.wrongTop,'tmapp://app/raw-denied.html',true,denied);
}
export function validatePortIsolation(proof){
 return proof?.schema==='tm-port-isolation-v1'&&proof.port===5173&&proof.ipv4?.address==='127.0.0.1'&&proof.ipv4?.port===5173&&proof.ipv4?.family==='IPv4'&&((proof.ipv6?.address==='::1'&&proof.ipv6?.port===5173&&proof.ipv6?.family==='IPv6'&&proof.ipv6Unavailable===null)||(proof.ipv6===null&&['EAFNOSUPPORT','EADDRNOTAVAIL','EPROTONOSUPPORT'].includes(proof.ipv6Unavailable)))&&proof.connections===0&&proof.trapError===false&&proof.packagedOrigin==='tmapp://app/index.html'&&proof.packagedHealth===true;
}
export function validateBackupCoverage(proof,version=2){return ['png','jpeg','distinctLogo','issuedPdf','exactInventory','verifiedSecretExclusion','freshRestore','activeRestore','assetHashes','logicalRows','tamperRejected',...(version===1?[]:['verifiedList','rejectedList'])].every(key=>proof?.[key]===true);}
export function validateStartupReadiness(proof){
 return proof?.health===true&&typeof proof.title==='string'&&proof.title.includes('Electrical T&M')&&proof.heading==='Local foundation cockpit'&&Number.isFinite(proof.elapsedMs)&&proof.elapsedMs>0&&proof.elapsedMs<=15000&&Number.isFinite(proof.rootWidth)&&proof.rootWidth>0&&Number.isFinite(proof.rootHeight)&&proof.rootHeight>0;
}
/** Simulate an interrupted directory switch only after a successful synthetic lifecycle. */
function runInterruptedRestoreDenial(binary,env,profile){
 const active=path.join(profile,'local-data'),rescue=path.join(profile,'.tm-rollback-native-proof');
 const readRows=file=>{const db=new DatabaseSync(file,{readOnly:true});try{return JSON.stringify({projects:db.prepare('SELECT id,project_code FROM projects ORDER BY id').all(),history:db.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all()});}finally{db.close();}};
 const census=root=>{const out=[];const visit=(folder,prefix)=>{for(const item of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(folder,item.name),rel=prefix+item.name;if(item.isDirectory())visit(p,rel+'/');else if(item.isFile())out.push([rel,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]);else throw new Error('Unexpected restore fixture object');}};visit(root,'');return JSON.stringify(out);};
 const file=path.join(active,'db','app.sqlite'),beforeRows=readRows(file),beforeBytes=census(active);
 const logPath=path.join(profile,'diagnostics','startup.jsonl'),previous=fs.readFileSync(logPath,'utf8').trim().split('\n').length;
 fs.renameSync(active,rescue);
 let attempt,missingActive=false,rescueUnchanged=false,events=[];
 try{
  attempt=spawnSync(binary,['--tm-smoke'],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true,env});
  missingActive=!fs.existsSync(active);rescueUnchanged=census(rescue)===beforeBytes;
  events=fs.readFileSync(logPath,'utf8').trim().split('\n').slice(previous).map(line=>JSON.parse(line));
 }finally{
  // Do not overwrite an unexpectedly created active data tree, even in a disposable fixture.
  if(!fs.existsSync(active))fs.renameSync(rescue,active);
 }
 const safeEvents=events.every(e=>Object.keys(e).sort().join(',')==='atUtc,event,state'&&/^[a-z][a-z0-9.-]{1,80}$/.test(e.event)&&['begin','pass','fail','info'].includes(e.state));
 const namedFailure=events.some(e=>e.event==='paths.prepare'&&e.state==='fail');
 const noOpen=events.every(e=>e.event!=='sqlite.open');
 const originalRecovered=missingActive&&rescueUnchanged&&census(active)===beforeBytes&&readRows(file)===beforeRows;
 const receipt={exitCode:attempt?.status??null,spawnFailed:!!attempt?.error,missingActive,rescueUnchanged,safeEvents,namedFailure,noOpen,originalRecovered,events:events.map(({event,state})=>({event,state}))};
 return {...receipt,verdict:validateInterruptedRestoreDenial({...receipt,verdict:'PASS'})?'PASS':'FAIL'};
}
export function validateInterruptedRestoreDenial(proof){
 return proof?.verdict==='PASS'&&proof.exitCode===1&&proof.spawnFailed===false&&['missingActive','rescueUnchanged','safeEvents','namedFailure','noOpen','originalRecovered'].every(key=>proof[key]===true)&&Array.isArray(proof.events)&&proof.events.some(e=>e.event==='paths.prepare'&&e.state==='fail')&&!proof.events.some(e=>e.event==='sqlite.open');
}
/** Asynchronous launch so the runner can actually observe connection attempts while the app runs. */
function spawnCaptured(executable,args,env,timeout=120000){
 return new Promise(resolve=>{
  const child=spawn(executable,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',error=null;
  const stop=reason=>{error=error??new Error(reason);child.kill('SIGKILL');};
  const timer=setTimeout(()=>stop('Native proof timed out'),timeout);
  child.stdout.on('data',bytes=>{stdout=(stdout+String(bytes)).slice(-2*1024*1024-1);if(stdout.length>2*1024*1024)stop('Native stdout exceeded bound');});
  child.stderr.on('data',bytes=>{stderr=(stderr+String(bytes)).slice(-2*1024*1024-1);if(stderr.length>2*1024*1024)stop('Native stderr exceeded bound');});
  child.once('error',e=>{error=e;});
  child.once('close',(status,signal)=>{clearTimeout(timer);resolve({status,signal,error,stdout,stderr});});
 });
}
/** Own only loopback sockets. Do not terminate or probe an unrelated process occupying 5173. */
async function runWithPortTrap(binary,env){
 let connections=0,ipv6Unavailable=null,trapError=false;const servers=[];
 const listen=async(host,ipv6Only=false)=>{
  const server=createServer(socket=>{connections++;socket.destroy();});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host,port:5173,exclusive:true,ipv6Only},resolve);});
  servers.push(server);server.on('error',()=>{trapError=true;});const address=server.address();if(!address||typeof address==='string')throw new Error('Missing bound socket identity');return address;
 };
 try{
  const ipv4=await listen('127.0.0.1');let ipv6=null;
  try{ipv6=await listen('::1',true);}catch(error){if(!['EAFNOSUPPORT','EADDRNOTAVAIL','EPROTONOSUPPORT'].includes(error.code))throw error;ipv6Unavailable=error.code;}
  const result=await spawnCaptured(binary,['--tm-smoke'],env);
  await new Promise(resolve=>setImmediate(resolve));
  return {result,proof:{schema:'tm-port-isolation-v1',port:5173,ipv4,ipv6,ipv6Unavailable,connections,trapError}};
 }finally{await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));}
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
 const probeEnv={...env,TM_LIFECYCLE_DUPLICATE_PROBE:'1'};delete probeEnv.TM_LIFECYCLE_RENDERER_CRASH_PROBE;delete probeEnv.TM_LIFECYCLE_INVALID_RENDERER_PROBE;delete probeEnv.TM_LIFECYCLE_ABNORMAL_PROBE;
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
/** Terminate only the runner-owned primary after its marked ready barrier. */
async function runAbnormalLifecycle(binary,env,profile,nonce,previous){
 const child=spawn(binary,['--tm-smoke'],{stdio:'ignore',windowsHide:true,env:{...env,TM_LIFECYCLE_ABNORMAL_PROBE:'1'}});
 let exited=null;const settled=new Promise(resolve=>{child.once('error',()=>resolve({code:null,signal:null,error:true}));child.once('close',(code,signal)=>resolve({code,signal,error:false}));});settled.then(value=>{exited=value;});
 try{
  const file=path.join(profile,'abnormal-ready.json'),deadline=Date.now()+45000;
  let ready;while(!exited&&Date.now()<deadline){try{ready=JSON.parse(fs.readFileSync(file,'utf8'));break;}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}await new Promise(r=>setTimeout(r,50));}
  if(!ready||exited||ready.pid!==child.pid||ready.nonce!==nonce||ready.projectId!==previous.projectId||ready.openedUtc!==previous.openedUtc||ready.credential!=='absent')throw new Error('Abnormal proof ready mismatch');
  if(!child.kill('SIGKILL'))throw new Error('Runner-owned abnormal termination failed');
  const exit=await settled;
  const db=new DatabaseSync(path.join(profile,'local-data','db','app.sqlite'),{readOnly:true});let integrity=false,stable=false;
  try{integrity=db.prepare('PRAGMA quick_check').get()?.quick_check==='ok'&&db.prepare('PRAGMA foreign_key_check').all().length===0;const rows=db.prepare('SELECT id,opened_utc,project_code FROM projects').all();stable=rows.length===1&&rows[0].id===previous.projectId&&rows[0].opened_utc===previous.openedUtc&&rows[0].project_code==='LIFECYCLE-001';}finally{db.close();}
  const terminated=!exit.error&&(exit.signal==='SIGKILL'||(Number.isInteger(exit.code)&&exit.code!==0));
  return {verdict:terminated&&integrity&&stable?'PASS':'FAIL',pid:ready.pid,terminated,integrity,stable,exit};
 }catch{return {verdict:'FAIL'};}
 finally{if(!exited){child.kill('SIGKILL');await settled;}}
}
export function validateAbnormalLifecycle(lifecycle){
 const a=lifecycle?.abnormal,r=lifecycle?.receipts;
 return a?.verdict==='PASS'&&a.terminated===true&&a.integrity===true&&a.stable===true&&Number.isInteger(a.pid)&&a.pid>0&&Array.isArray(r)&&r.length===3&&r[0].uiCreated===true&&r.slice(1).every(x=>x.uiCreated===false)&&r.every(x=>x.pid!==a.pid)&&lifecycle.duplicate?.primaryPid===r[2].pid;
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
/** Misname only the selected packed entry in a disposable ASAR copy. Its original
 * JSON header, data bytes and embedded file hashes must otherwise be identical. */
export function misnamePackedEntrypoint(bytes,entry){
 const names={'main.cjs':'xain.cjs','preload.cjs':'xreload.cjs','index.html':'xndex.html'};
 if(!Object.hasOwn(names,entry)||!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>64*1024*1024)throw new Error('Invalid entrypoint damage fixture');
 const [four,headerSize,payloadSize,jsonSize]=[0,4,8,12].map(offset=>bytes.readUInt32LE(offset));
 const dataOffset=8+headerSize;
 if(four!==4||headerSize!==payloadSize+4||jsonSize===0||jsonSize>16*1024*1024||16+jsonSize>dataOffset||dataOffset>bytes.length)throw new Error('Invalid ASAR header');
 const raw=bytes.subarray(16,16+jsonSize),header=JSON.parse(raw.toString('utf8'));
 if(!Buffer.from(JSON.stringify(header)).equals(raw))throw new Error('ASAR header cannot be changed without collateral formatting');
 const vite=header.files?.['.vite']?.files;
 const directory=entry==='index.html'?vite?.renderer?.files?.main_window:vite?.build;
 const build=directory?.files;
 if(!build||!Object.hasOwn(build,entry)||Object.hasOwn(build,names[entry]))throw new Error('ASAR entrypoint not uniquely present');
 const original=build[entry];
 if(!original||original.files||original.link||original.unpacked||!Number.isSafeInteger(original.size)||original.size<=0||typeof original.offset!=='string'||!/^\d+$/.test(original.offset))throw new Error('ASAR entrypoint is not a packed regular file');
 const offset=Number(original.offset);
 if(!Number.isSafeInteger(offset)||offset<0||dataOffset+offset+original.size>bytes.length)throw new Error('ASAR entrypoint extent invalid');
 // Preserve property order as well as all unrelated fields and the data payload.
 directory.files=Object.fromEntries(Object.entries(build).map(([key,value])=>[key===entry?names[entry]:key,value]));
 const changed=Buffer.from(JSON.stringify(header));
 if(changed.length!==raw.length)throw new Error('ASAR misname changed the header length');
 const out=Buffer.from(bytes);changed.copy(out,16);
 if(out.equals(bytes)||!out.subarray(dataOffset).equals(bytes.subarray(dataOffset)))throw new Error('ASAR fault not isolated');
 return out;
}
const entryHash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function requireOwnedDescriptor(file,fd,expected=null){
 const opened=fs.fstatSync(fd),named=fs.lstatSync(file);
 if(!opened.isFile()||opened.nlink!==1||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==opened.dev||named.ino!==opened.ino||named.size!==opened.size||named.mtimeMs!==opened.mtimeMs||named.ctimeMs!==opened.ctimeMs||expected&&(opened.dev!==expected.dev||opened.ino!==expected.ino||opened.size!==expected.size))throw new Error('Unsafe or changed owned fixture identity');
 return opened;
}
function readDescriptor(fd,size){
 const bytes=Buffer.alloc(size);let offset=0;
 while(offset<size){const n=fs.readSync(fd,bytes,offset,size-offset,offset);if(!n)throw new Error('Short owned fixture read');offset+=n;}
 return bytes;
}
function readOwnedFile(file,limit,expected=null){
 if(!file||!path.isAbsolute(file)||!Number.isSafeInteger(limit)||limit<0)throw new Error('Invalid owned fixture location');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{
  const opened=requireOwnedDescriptor(file,fd,expected);
  if(opened.size>limit)throw new Error('Owned fixture exceeds read limit');
  const bytes=readDescriptor(fd,opened.size),after=requireOwnedDescriptor(file,fd,opened);
  if(opened.mtimeMs!==after.mtimeMs||opened.ctimeMs!==after.ctimeMs)throw new Error('Owned fixture changed during read');
  return {bytes,identity:opened};
 }finally{fs.closeSync(fd);}
}
function writeOwnedFixture(file,bytes,identity,prior=null,onMutation=()=>{}){
 if(!identity||identity.size!==bytes.length)throw new Error('Invalid owned fixture write');
 const fd=fs.openSync(file,fs.constants.O_RDWR|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{
  const opened=requireOwnedDescriptor(file,fd,identity);
  if(prior&&!readDescriptor(fd,opened.size).equals(prior))throw new Error('Copied ASAR changed before mutation');
  requireOwnedDescriptor(file,fd,identity);
  onMutation();let offset=0;while(offset<bytes.length){const n=fs.writeSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)throw new Error('Short fixture write');offset+=n;}
  fs.fsyncSync(fd);requireOwnedDescriptor(file,fd,identity);
  const check=readDescriptor(fd,bytes.length);requireOwnedDescriptor(file,fd,identity);
  if(!check.equals(bytes))throw new Error('Copied ASAR readback failed');
 }finally{fs.closeSync(fd);}
}
/** Read and dismiss only a named loader-error modal owned by the exact fixture PID.
 * Do not enable accessibility permissions, change trust settings, or touch any other dialog. */
const macLoaderDialogScript=String.raw`on run argv
 set targetPid to item 1 of argv as integer
 tell application "System Events"
  set matches to every application process whose unix id is targetPid
  if (count of matches) is not 1 then return "WAIT"
  tell item 1 of matches
   repeat with w in (every window)
    try
     set heading to name of w as text
     set bodyText to ""
     set okButtons to {}
     repeat with el in (entire contents of w)
      try
       if role of el is "AXStaticText" then
        set bodyText to bodyText & linefeed & (value of el as text)
       else if role of el is "AXButton" and name of el is "OK" then
        set end of okButtons to el
       end if
      end try
     end repeat
     set allText to heading & linefeed & bodyText
     if (allText contains "Error launching app" or allText contains "A JavaScript error occurred in the main process") and allText contains "main.cjs" and (allText contains "Cannot find module" or allText contains "Unable to find Electron app" or allText contains "Cannot find Electron app") and (count of okButtons) is 1 then
      click item 1 of okButtons
      return "TM_LOADER_DIALOG_DISMISSED" & linefeed & allText
     end if
    end try
   end repeat
  end tell
 end tell
 return "WAIT"
end run`;
const windowsLoaderDialogScript=String.raw`$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$targetPid=[int]$env:TM_NATIVE_DIALOG_PID
$ae=[System.Windows.Automation.AutomationElement]
$ts=[System.Windows.Automation.TreeScope]
$pc=New-Object System.Windows.Automation.PropertyCondition($ae::ProcessIdProperty,$targetPid)
$windows=$ae::RootElement.FindAll($ts::Children,$pc)
foreach($w in $windows){
 if($w.Current.Name -notin @('Error launching app','A JavaScript error occurred in the main process')){continue}
 $texts=@($w.Current.Name);$buttons=@()
 foreach($el in $w.FindAll($ts::Descendants,[System.Windows.Automation.Condition]::TrueCondition)){
  if($el.Current.ProcessId -ne $targetPid){continue}
  if($el.Current.ControlType -eq [System.Windows.Automation.ControlType]::Text){$texts+=$el.Current.Name}
  if($el.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $el.Current.Name -eq 'OK'){$buttons+=,$el}
 }
 $body=$texts -join [Environment]::NewLine
 if($body -cmatch 'main\.cjs' -and $body -cmatch 'Cannot find module|Unable to find Electron app|Cannot find Electron app' -and $buttons.Count -eq 1){
  $invoke=$buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  $invoke.Invoke();Write-Output 'TM_LOADER_DIALOG_DISMISSED';Write-Output $body;exit 0
 }
}
Write-Output 'WAIT'`;
function namedLoaderDialogText(text){
 return typeof text==='string'&&text.length<=65536&&/^TM_LOADER_DIALOG_DISMISSED\r?\n/.test(text)&&(text.includes('Error launching app')||text.includes('A JavaScript error occurred in the main process'))&&/main\.cjs/i.test(text)&&/Cannot find module|Unable to find Electron app|Cannot find Electron app/i.test(text);
}
function observeLoaderDialog(pid){
 if(!Number.isSafeInteger(pid)||pid<=0)return {state:'UNAVAILABLE',text:null};
 const result=process.platform==='darwin'?spawnSync('/usr/bin/osascript',['-e',macLoaderDialogScript,String(pid)],{encoding:'utf8',timeout:3500,maxBuffer:65536}):
  spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',windowsLoaderDialogScript],{encoding:'utf8',timeout:3500,maxBuffer:65536,windowsHide:true,env:{...process.env,TM_NATIVE_DIALOG_PID:String(pid)}});
 if(result.error||result.status!==0)return {state:'UNAVAILABLE',text:null};
 if(namedLoaderDialogText(result.stdout))return {state:'NAMED_DISMISSED',text:result.stdout};
 return {state:result.stdout?.trim()==='WAIT'?'WAIT':'UNAVAILABLE',text:null};
}
async function spawnWithLoaderObservation(executable,args,env){
 const child=spawn(executable,args,{env,windowsHide:false,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',error=null,closed=false,status=null,signal=null,dialog={state:'WAIT',text:null};
 const stop=e=>{error=error??e;if(!closed)child.kill('SIGKILL');};
 child.stdout.on('data',bytes=>{stdout+=String(bytes);if(stdout.length>2*1024*1024)stop(new Error('Native stdout exceeded bound'));});
 child.stderr.on('data',bytes=>{stderr+=String(bytes);if(stderr.length>2*1024*1024)stop(new Error('Native stderr exceeded bound'));});
 const settled=new Promise(resolve=>{child.once('error',e=>{error=e;});child.once('close',(code,sig)=>{status=code;signal=sig;closed=true;resolve();});});
 const deadline=Date.now()+30000;
 try{
  while(!closed&&Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,500));
   if(closed)break;
   if(dialog.state==='WAIT'&&Number.isSafeInteger(child.pid))dialog=observeLoaderDialog(child.pid);
  }
  if(!closed)stop(Object.assign(new Error('Native loader observation timed out'),{code:'ETIMEDOUT'}));
  await settled;
  return {status,signal,error,stdout,stderr,dialog};
 }finally{if(!closed){stop(new Error('Native loader observer interrupted'));await settled;}}
}
/** A pre-main loader failure cannot produce our own application diagnostics. Only
 * observed, named loader output and a natural exit count as loader evidence.
 * An OS refusal, signal, timeout or ambiguous exit is never substituted for it. */
function classifyEntrypointDenial(entry,result,events,statePreserved,sentinelFree){
 const output=(result.stdout||'')+'\n'+(result.stderr||'');
 const loaderLine=entry==='main.cjs'?output.split(/\r?\n/).find(line=>/Cannot find module|Unable to find Electron app|Cannot find Electron app|Error launching app/i.test(line)&&/main\.cjs/i.test(line)):undefined;
 const observedDialog=entry==='main.cjs'&&result.dialog?.state==='NAMED_DISMISSED'&&namedLoaderDialogText(result.dialog.text);
 const loaderNamed=typeof loaderLine==='string'||observedDialog;
 const loaderDiagnostic=loaderNamed?{message:'Named Electron loader error referring to main.cjs',lineSha256:entryHash(Buffer.from(loaderLine??result.dialog.text)),surface:typeof loaderLine==='string'?'PROCESS_STREAM':'OWNED_NATIVE_ERROR_DIALOG'}:null;
 const streams=Object.fromEntries(['stdout','stderr'].map(key=>{const b=Buffer.from(result[key]||'');return [key,{bytes:b.length,sha256:entryHash(b)}];}));
 const timeout=result.error?.code==='ETIMEDOUT';
 const exitCode=result.status??null,signal=result.signal??null,spawnFailed=!!result.error;
 const safeEvents=events.every(e=>Object.keys(e).sort().join(',')==='atUtc,event,state'&&/^[a-z][a-z0-9.-]{1,80}$/.test(e.event)&&['begin','pass','fail','info'].includes(e.state));
 const failureEvent=entry==='index.html'?'renderer.load':'renderer.preload';
 const namedFailure=events.some(e=>e.event===failureEvent&&e.state==='fail');
 const shutdown=events.some(e=>e.event==='shutdown'&&e.state==='pass');
 const noApplicationStartup=events.length===0;
 const loaderProof=entry==='main.cjs'&&loaderNamed&&noApplicationStartup;
 const applicationProof=['preload.cjs','index.html'].includes(entry)&&namedFailure&&shutdown&&!events.some(e=>e.event==='renderer.load'&&e.state==='pass');
 const pass=!spawnFailed&&signal===null&&exitCode===1&&safeEvents&&statePreserved&&sentinelFree&&(loaderProof||applicationProof);
 return {entry,verdict:pass?'PASS':'FAIL',classification:pass?(loaderProof?'NAMED_ELECTRON_LOADER_DENIAL':entry==='index.html'?'NAMED_APPLICATION_RENDERER_DENIAL':'NAMED_APPLICATION_PRELOAD_DENIAL'):timeout?'TIMEOUT_UNPROVEN':spawnFailed?'SPAWN_ERROR_UNPROVEN':signal?'SIGNAL_UNPROVEN':'UNCLASSIFIED_OR_UNSAFE_DENIAL',exitCode,signal,spawnFailed,timeout,loaderNamed,loaderDiagnostic,streams,noApplicationStartup,safeEvents,namedFailure,shutdown,statePreserved,sentinelFree,events:events.map(({event,state})=>({event,state}))};
}
async function runDamagedEntrypoints(copiedBinary,copiedAsar,originalBytes,env,profile,logPath,state,before,sentinels){
 const results=[];
 const owned=readOwnedFile(copiedAsar,64*1024*1024);
 if(!owned.bytes.equals(originalBytes))throw new Error('Copied ASAR differs from original before fault');
 for(const entry of ['preload.cjs','main.cjs','index.html']){
  const changed=misnamePackedEntrypoint(originalBytes,entry);
  const prior=fs.readFileSync(logPath,'utf8');
  let row={entry,verdict:'FAIL',classification:'FIXTURE_OR_LAUNCH_UNPROVEN',mutatedSha256:entryHash(changed),faultInjected:false},mutationStarted=false;
  try{
   writeOwnedFixture(copiedAsar,changed,owned.identity,originalBytes,()=>{mutationStarted=true;});
   const injected=readOwnedFile(copiedAsar,changed.length,owned.identity).bytes.equals(changed);if(!injected)throw new Error('Entrypoint fault not injected');
   row.faultInjected=true;
   const args=['--tm-smoke','--user-data-dir='+profile];
   const attempt=entry==='main.cjs'?await spawnWithLoaderObservation(copiedBinary,args,env):spawnSync(copiedBinary,args,{encoding:'utf8',timeout:30000,killSignal:'SIGKILL',maxBuffer:2*1024*1024,windowsHide:true,env});
   const log=fs.readFileSync(logPath,'utf8');
   const prefixPreserved=log.startsWith(prior);
   const events=prefixPreserved?log.slice(prior.length).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
   // Diagnostic content must not contain synthetic customer or credential values.
   // Loader messages may include the copied application's path; never publish them raw.
   const output=(attempt.stdout||'')+'\n'+(attempt.stderr||'');
   const safe=sentinels.every(value=>!log.includes(value))&&sentinels.slice(0,2).every(value=>!output.includes(value)&&!(attempt.dialog?.text||'').includes(value));
   row=classifyEntrypointDenial(entry,attempt,events,prefixPreserved&&state()===before,safe);
   if(entry==='main.cjs')row.dialogObservation=attempt.dialog?.state??'NOT_ATTEMPTED';
   row.faultInjected=injected&&readOwnedFile(copiedAsar,changed.length,owned.identity).bytes.equals(changed);row.mutatedSha256=entryHash(changed);
  }catch{/* Record only the fixed unproven classification; never echo arbitrary exception data. */}
  finally{if(mutationStarted)writeOwnedFixture(copiedAsar,originalBytes,owned.identity);}
  results.push({...row,copyRestored:readOwnedFile(copiedAsar,originalBytes.length,owned.identity).bytes.equals(originalBytes)});
 }
 return {schema:'tm-native-damaged-entrypoints-v2',synthetic:true,originalAsarSha256:entryHash(originalBytes),results};
}
export function validateDamagedEntrypoints(proof,requireHtml=false){
 const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const entries=proof?.schema==='tm-native-damaged-entrypoints-v2'?['preload.cjs','main.cjs','index.html']:proof?.schema==='tm-native-damaged-entrypoints-v1'&&!requireHtml?['preload.cjs','main.cjs']:null;
 if(!entries||proof.synthetic!==true||!digest(proof.originalAsarSha256)||!Array.isArray(proof.results)||proof.results.length!==entries.length)return false;
 return new Set(proof.results.map(x=>x.mutatedSha256)).size===entries.length&&proof.results.every((x,i)=>{
  const entry=entries[i],appFailure=entry!=='main.cjs',event=entry==='index.html'?'renderer.load':'renderer.preload';
  if(x?.entry!==entry||x.verdict!=='PASS'||x.exitCode!==1||x.signal!==null||x.spawnFailed!==false||x.timeout!==false||!['faultInjected','copyRestored','statePreserved','sentinelFree','safeEvents'].every(k=>x[k]===true)||!digest(x.mutatedSha256)||x.mutatedSha256===proof.originalAsarSha256||!Array.isArray(x.events)||!['stdout','stderr'].every(k=>Number.isSafeInteger(x.streams?.[k]?.bytes)&&x.streams[k].bytes>=0&&digest(x.streams[k].sha256)))return false;
  return appFailure?x.classification===(entry==='index.html'?'NAMED_APPLICATION_RENDERER_DENIAL':'NAMED_APPLICATION_PRELOAD_DENIAL')&&x.namedFailure===true&&x.shutdown===true&&x.events.some(e=>e.event===event&&e.state==='fail')&&x.events.some(e=>e.event==='shutdown'&&e.state==='pass')&&!x.events.some(e=>e.event==='renderer.load'&&e.state==='pass'):x.classification==='NAMED_ELECTRON_LOADER_DENIAL'&&x.loaderNamed===true&&x.loaderDiagnostic?.message==='Named Electron loader error referring to main.cjs'&&digest(x.loaderDiagnostic.lineSha256)&&(!x.loaderDiagnostic.surface||x.loaderDiagnostic.surface==='PROCESS_STREAM'||x.loaderDiagnostic.surface==='OWNED_NATIVE_ERROR_DIALOG'&&x.dialogObservation==='NAMED_DISMISSED')&&x.noApplicationStartup===true&&x.events.length===0;
 });
}
/** A real native failure must terminate, preserve seeded synthetic data, and emit only safe diagnostic fields. */
async function runDiagnosticDenials(binary,env,profile){
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
 let missingResource=null,rendererCrash=null,invalidRenderer=null,damagedEntrypoints=null,originalUnchanged=false;
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
  fs.renameSync(path.join(copiedResources,'migrations-synthetic-missing'),path.join(copiedResources,'migrations'));
  const originalAsar=fs.readFileSync(path.join(originalResources,'app.asar')),copiedAsar=path.join(copiedResources,'app.asar');
  if(!fs.readFileSync(copiedAsar).equals(originalAsar))throw new Error('Copied ASAR differs from original before fault');
  try{damagedEntrypoints=await runDamagedEntrypoints(copiedBinary,copiedAsar,originalAsar,env,profile,logPath,state,before,[pii,credential,profile,sentinelPath]);}catch{damagedEntrypoints={schema:'tm-native-damaged-entrypoints-v2',synthetic:true,originalAsarSha256:entryHash(originalAsar),results:[],failure:'FIXTURE_OR_RESTORE_UNPROVEN'};}
  originalUnchanged=originalIdentity===resourceIdentity();
  invalidRenderer=attempt(binary,{...env,TM_LIFECYCLE_INVALID_RENDERER_PROBE:'1'},'renderer.load');
  rendererCrash=attempt(binary,{...env,TM_LIFECYCLE_RENDERER_CRASH_PROBE:'1'},'renderer.process');
  originalUnchanged=originalUnchanged&&originalIdentity===resourceIdentity();
 }finally{fs.rmSync(fixture,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 return {schema:'tm-native-diagnostic-denials-v1',synthetic:true,missingResource,rendererCrash,invalidRenderer,damagedEntrypoints,originalUnchanged};
}
export function validateDiagnosticDenials(report){
 return report?.schema==='tm-native-diagnostic-denials-v1'&&report.synthetic===true&&report.originalUnchanged===true&&['missingResource','rendererCrash'].every(k=>{
  const v=report[k];return v?.verdict==='PASS'&&v.exitCode===1&&v.spawnFailed===false&&['safeEventFields','sentinelFree','namedFailure','shutdown','logicalStatePreserved'].every(flag=>v[flag]===true)&&Array.isArray(v.events)&&v.events.some(e=>e.event===(k==='missingResource'?'sqlite.open':'renderer.process')&&e.state==='fail')&&v.events.some(e=>e.event==='shutdown'&&e.state==='pass');
 });
}
export function validateInvalidRendererDenial(report){
 const v=report?.invalidRenderer;
 return v?.verdict==='PASS'&&v.exitCode===1&&v.spawnFailed===false&&['safeEventFields','sentinelFree','namedFailure','shutdown','logicalStatePreserved'].every(flag=>v[flag]===true)&&Array.isArray(v.events)&&v.events.some(e=>e.event==='renderer.load'&&e.state==='fail')&&v.events.some(e=>e.event==='shutdown'&&e.state==='pass')&&!v.events.some(e=>e.event==='packaged.invalid-renderer-probe'&&e.state==='fail');
}
export function validateAdversarialLifecycle(lifecycle){
 return lifecycle?.duplicate?.verdict==='PASS'&&lifecycle.duplicate.primary?.exitCode===0&&lifecycle.duplicate.secondary?.exitCode===0&&Number.isInteger(lifecycle.duplicate.primaryPid)&&lifecycle.duplicate.primaryPid>0&&Number.isInteger(lifecycle.duplicate.secondary?.pid)&&lifecycle.duplicate.secondary.pid>0&&lifecycle.duplicate.secondary.pid!==lifecycle.duplicate.primaryPid&&lifecycle.receipts?.[2]?.secondaryLaunches===1&&lifecycle.duplicateEvents===1&&lifecycle.startupDenial?.verdict==='PASS'&&lifecycle.startupDenial.exitCode===1&&lifecycle.startupDenial.logicalStatePreserved===true&&lifecycle.startupDenial.safeEventFields===true&&lifecycle.startupDenial.namedFailure===true;
}
async function runLifecycle(binary){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));
 const nonce=crypto.randomBytes(16).toString('hex');
 let receipts=[],runs=[],duplicate=null,startupDenial=null,diagnosticDenials=null,interruptedRestore=null,abnormal=null;
 try{
  fs.writeFileSync(path.join(profile,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{flag:'wx',mode:0o600});
  for(const stage of LIFECYCLE_STAGES){
   const env={...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:stage,TM_LIFECYCLE_NONCE:nonce,ELECTRON_ENABLE_LOGGING:'1'};
   delete env.TM_LIFECYCLE_DUPLICATE_PROBE;delete env.TM_LIFECYCLE_RENDERER_CRASH_PROBE;delete env.TM_LIFECYCLE_INVALID_RENDERER_PROBE;delete env.TM_LIFECYCLE_ABNORMAL_PROBE;
   if(stage==='revoked'){
    abnormal=await runAbnormalLifecycle(binary,env,profile,nonce,receipts[0]);
    if(abnormal.verdict!=='PASS')break;
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
   const denialEnv={...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:'revoked',TM_LIFECYCLE_NONCE:nonce,ELECTRON_ENABLE_LOGGING:'1'};delete denialEnv.TM_LIFECYCLE_DUPLICATE_PROBE;delete denialEnv.TM_LIFECYCLE_RENDERER_CRASH_PROBE;delete denialEnv.TM_LIFECYCLE_INVALID_RENDERER_PROBE;delete denialEnv.TM_LIFECYCLE_ABNORMAL_PROBE;
   diagnosticDenials=await runDiagnosticDenials(binary,denialEnv,profile);
   interruptedRestore=runInterruptedRestoreDenial(binary,denialEnv,profile);
   startupDenial=runStartupDenial(binary,denialEnv,profile);
  }
  const report={runs,receipts,shutdowns,duplicateEvents,duplicate,startupDenial,diagnosticDenials,interruptedRestore,abnormal};
  return {...report,verdict:runs.length===3&&runs.every(r=>r.exitCode===0&&!r.failed)&&validateLifecycleReceipts(receipts,nonce)&&shutdowns===3&&validateAdversarialLifecycle(report)&&validateDiagnosticDenials(diagnosticDenials)&&validateInvalidRendererDenial(diagnosticDenials)&&validateInterruptedRestoreDenial(interruptedRestore)&&validateAbnormalLifecycle(report)?'PASS':'FAIL'};
 }catch{return {verdict:'FAIL',runs,receipts,duplicate,startupDenial,diagnosticDenials,interruptedRestore,abnormal,shutdowns:null};}
 finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
const DEV_CSP=REQUIRED_CSP.replace("style-src 'self'","style-src 'self' 'unsafe-inline'").replace("connect-src 'none'","connect-src 'self' ws://localhost:* ws://127.0.0.1:*");
export function validateDevelopmentHmrReceipt(receipt){
 if(receipt?.schema!=='tm-dev-hmr-v1'||receipt.synthetic!==true||receipt.documentPreserved!==true||receipt.loopbackOrigin!==true||!/^[a-f0-9]{32}$/.test(receipt.nonce))return false;
 return ['before','after'].every((key,i)=>{
  const row=receipt[key];return row?.value===(i?'updated-':'initial-')+receipt.nonce&&row.marker===receipt.nonce&&row.title==='Local foundation cockpit'&&row.csp===DEV_CSP&&row.health===true&&row.requireAbsent===true&&row.processAbsent===true;
 });
}
/** Preserve the raw native log; permit only Electron's exact one-time download notice. */
export function parseDevelopmentHmrRunnerLog(log){
 const report=JSON.parse(log.replace(/^Downloading Electron binary\.\.\.\r?\n/,''));
 if(report?.schema!=='tm-dev-hmr-runner-v1'||report.verdict!=='PASS'||report.synthetic!==true||report.viteVersion!=='8.3.8'||report.fixtureOnly!==true||report.exit?.exitCode!==0||report.exit?.spawnFailed!==false||!validateDevelopmentHmrReceipt(report.receipt))throw new Error('Actual development HMR proof missing');
 return report;
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
  const env={...process.env,TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:'seed',TM_LIFECYCLE_NONCE:nonce};delete env.TM_LIFECYCLE_DUPLICATE_PROBE;delete env.TM_LIFECYCLE_RENDERER_CRASH_PROBE;delete env.TM_LIFECYCLE_INVALID_RENDERER_PROBE;delete env.TM_LIFECYCLE_ABNORMAL_PROBE;delete env.TM_SMOKE_REPORT_PATH;delete env.ELECTRON_RUN_AS_NODE;
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
  const rendererSecurity={schema:'tm-renderer-security-v2',synthetic:true,stateUnchanged:true,navigationAttempted:true,navigationDenied:true,actualPrefs:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false},isolation:{requireAbsent:true,processAbsent:true,bridgeKeys:[...SECURITY_METHODS_V2],csp:REQUIRED_CSP},expectedCsp:REQUIRED_CSP,security:{inlineBlocked:true,evalBlocked:true,networkBlocked:true,frameBlocked:true,popupDenied:true,permissionDenied:true,violations:['script-src-elem','script-src','connect-src','frame-src']},foreignResults:SECURITY_METHODS_V2.map(method=>({method,code:'SECURITY'})),malformedResults:MALFORMED_CASES.map(id=>({id,code:'VALIDATION'}))};
  const extended={...cockpitFlow,firstRunEmpty:true,statusReasonsPersisted:true,themeStatePreserved:true,interaction:{...cockpitFlow.interaction,duplicateDenied:true,missingCustomerDenied:true,taxLengthDenied:true,cancelEdit:true,cancelStatus:true,longContent:true,disabledReason:true},layouts:cockpitFlow.layouts.map(x=>({...x,contentSize:[x.requestedWidth,x.requestedHeight],textChecks:25,minTextRatio:4.5,minLargeRatio:3,focusRatio:3,focusVisible:true,screenshot:{name:`cockpit-${x.requestedWidth}x${x.requestedHeight}-${x.appearance}.png`,bytes:1024,sha256:'a'.repeat(64),width:x.requestedWidth,height:x.requestedHeight}}))};
  if(!validateExtendedCockpitReceipt(extended)||validateExtendedCockpitReceipt({...extended,statusReasonsPersisted:false})||validateExtendedCockpitReceipt({...extended,layouts:extended.layouts.map(x=>({...x,minTextRatio:4.49}))})||validateExtendedCockpitReceipt({...extended,layouts:extended.layouts.map(x=>({...x,screenshot:null}))})||validateExtendedCockpitReceipt({...extended,layouts:extended.layouts.map(x=>({...x,screenshot:{...x.screenshot,height:x.screenshot.height-100}}))}))throw new Error('Extended cockpit receipt contract self-test failed');
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
  const hmrLog=JSON.stringify({schema:'tm-dev-hmr-runner-v1',verdict:'PASS',synthetic:true,viteVersion:'8.3.8',fixtureOnly:true,exit:{exitCode:0,spawnFailed:false},receipt:hmr});
  for(const log of [hmrLog,'Downloading Electron binary...\n'+hmrLog,'Downloading Electron binary...\r\n'+hmrLog])parseDevelopmentHmrRunnerLog(log);
  for(const log of ['unknown notice\n'+hmrLog,'Downloading Electron binary...\nDownloading Electron binary...\n'+hmrLog,hmrLog+'\n{}',hmrLog.replace('"spawnFailed":false','"spawnFailed":true'),hmrLog.replace('"fixtureOnly":true','"fixtureOnly":false')]){
   let rejected=false;try{parseDevelopmentHmrRunnerLog(log);}catch{rejected=true;}if(!rejected)throw new Error('Invalid HMR runner log accepted');
  }
  const rawRow=(url,main,cases)=>({url,main,results:cases.map(([name,code])=>({name,code,correlated:code!=='UNREGISTERED',health:code==='OK'}))});
  const deny=RAW_CHANNELS_V2.map(channel=>[channel,'SECURITY']);
  const raw={schema:'tm-native-raw-ipc-v2',synthetic:true,source:'packaged-binary',stateUnchanged:true,trusted:rawRow('tmapp://app/raw-ipc-proof.html',true,RAW_CASES),children:[rawRow('tmapp://app/raw-frame.html',false,deny),rawRow('tmapp://raw-fixture/raw-frame.html',false,deny)],wrongTop:rawRow('tmapp://app/raw-denied.html',true,deny)};
  const legacyRaw={...raw,schema:'tm-native-raw-ipc-v1',children:raw.children.map(frame=>({...frame,results:frame.results.filter(x=>x.name!=='backup.listVerified')})),wrongTop:{...raw.wrongTop,results:raw.wrongTop.results.filter(x=>x.name!=='backup.listVerified')}};
  const legacySecurity={...rendererSecurity,schema:'tm-renderer-security-v1',isolation:{...rendererSecurity.isolation,bridgeKeys:SECURITY_METHODS},foreignResults:rendererSecurity.foreignResults.filter(x=>x.method!=='listVerifiedBackups')};
  if(!validateRawIpcProof(legacyRaw,1)||validateRawIpcProof(legacyRaw)||validateRawIpcProof(raw,1)||!validateRendererSecurityReceipt(legacySecurity,1)||validateRendererSecurityReceipt(legacySecurity)||validateRendererSecurityReceipt(rendererSecurity,1))throw new Error('Historical IPC proof version mismatch');
  if(!validateRawIpcProof(raw)||validateRawIpcProof({...raw,stateUnchanged:false})||validateRawIpcProof({...raw,children:raw.children.slice(0,1)})||validateRawIpcProof({...raw,trusted:{...raw.trusted,results:raw.trusted.results.map(x=>x.name==='extra-argument'?{...x,code:'OK'}:x)}})||validateRawIpcProof({...raw,wrongTop:{...raw.wrongTop,results:raw.wrongTop.results.map(x=>({...x,correlated:false}))}}))throw new Error('Raw IPC receipt contract self-test failed');
  const port={schema:'tm-port-isolation-v1',port:5173,ipv4:{address:'127.0.0.1',port:5173,family:'IPv4'},ipv6:{address:'::1',port:5173,family:'IPv6'},ipv6Unavailable:null,connections:0,trapError:false,packagedOrigin:'tmapp://app/index.html',packagedHealth:true};
  if(!validatePortIsolation(port)||validatePortIsolation({...port,connections:1})||validatePortIsolation({...port,packagedOrigin:'http://localhost:5173/'})||validatePortIsolation({...port,ipv6:null})||!validatePortIsolation({...port,ipv6:null,ipv6Unavailable:'EAFNOSUPPORT'}))throw new Error('Port isolation receipt contract self-test failed');
  const invalid={...denials,invalidRenderer:diag('renderer.load')};
  if(!validateInvalidRendererDenial(invalid)||validateInvalidRendererDenial({...invalid,invalidRenderer:{...invalid.invalidRenderer,events:[...invalid.invalidRenderer.events,{event:'packaged.invalid-renderer-probe',state:'fail'}]}}))throw new Error('Invalid renderer receipt contract self-test failed');
  const makeFixture=()=>{
   const data=Buffer.from('mainpreloadhtml'),header=Buffer.from(JSON.stringify({files:{'.vite':{files:{build:{files:{'main.cjs':{size:4,offset:'0'},'preload.cjs':{size:7,offset:'4'}}},renderer:{files:{main_window:{files:{'index.html':{size:4,offset:'11'}}}}}}}}}));
   const padded=(header.length+3)&~3,prefix=Buffer.alloc(16+padded);prefix.writeUInt32LE(4,0);prefix.writeUInt32LE(8+padded,4);prefix.writeUInt32LE(4+padded,8);prefix.writeUInt32LE(header.length,12);header.copy(prefix,16);return Buffer.concat([prefix,data]);
  };
  const originalFixture=makeFixture(),renamedMain=misnamePackedEntrypoint(originalFixture,'main.cjs'),renamedPreload=misnamePackedEntrypoint(originalFixture,'preload.cjs');
  const leaves=b=>Object.keys(JSON.parse(b.subarray(16,16+b.readUInt32LE(12)).toString('utf8')).files['.vite'].files.build.files);
  const renamedHtml=misnamePackedEntrypoint(originalFixture,'index.html');
  const htmlLeaves=b=>Object.keys(JSON.parse(b.subarray(16,16+b.readUInt32LE(12)).toString('utf8')).files['.vite'].files.renderer.files.main_window.files);
  if(htmlLeaves(renamedHtml).join(',')!=='xndex.html'||htmlLeaves(originalFixture).join(',')!=='index.html'||leaves(renamedHtml).join(',')!==leaves(originalFixture).join(',')||!renamedHtml.subarray(-15).equals(originalFixture.subarray(-15)))throw new Error('HTML fault isolation self-test failed');
  if(leaves(renamedMain).join(',')!=='xain.cjs,preload.cjs'||leaves(renamedPreload).join(',')!=='main.cjs,xreload.cjs'||leaves(originalFixture).join(',')!=='main.cjs,preload.cjs'||!renamedMain.subarray(-11).equals(originalFixture.subarray(-11)))throw new Error('ASAR fault isolation self-test failed');
  for(const [data,entry] of [[Buffer.alloc(4),'main.cjs'],[originalFixture,'bad.cjs'],[renamedMain,'main.cjs']]){let rejected=false;try{misnamePackedEntrypoint(data,entry);}catch{rejected=true;}if(!rejected)throw new Error('Malformed ASAR fault fixture accepted');}
  const nativeEvents=[{atUtc:'2026-11-24T00:00:00.000Z',event:'renderer.preload',state:'fail'},{atUtc:'2026-11-24T00:00:00.000Z',event:'shutdown',state:'pass'}];
  const loader=classifyEntrypointDenial('main.cjs',{status:1,stderr:'Cannot find module <synthetic>/main.cjs'},[],true,true);
  const preload=classifyEntrypointDenial('preload.cjs',{status:1},nativeEvents,true,true);
  const damaged={schema:'tm-native-damaged-entrypoints-v1',synthetic:true,originalAsarSha256:entryHash(originalFixture),results:[{...preload,faultInjected:true,copyRestored:true,mutatedSha256:entryHash(renamedPreload)},{...loader,faultInjected:true,copyRestored:true,mutatedSha256:entryHash(renamedMain)}]};
  const html=classifyEntrypointDenial('index.html',{status:1},nativeEvents.map(e=>e.event==='renderer.preload'?{...e,event:'renderer.load'}:e),true,true);
  const extendedDamage={...damaged,schema:'tm-native-damaged-entrypoints-v2',results:[...damaged.results,{...html,faultInjected:true,copyRestored:true,mutatedSha256:entryHash(renamedHtml)}]};
  if(!validateDamagedEntrypoints(extendedDamage,true)||validateDamagedEntrypoints(damaged,true)||validateDamagedEntrypoints({...extendedDamage,results:extendedDamage.results.slice(0,2)},true)||validateDamagedEntrypoints({...extendedDamage,results:[...extendedDamage.results.slice(0,2),{...extendedDamage.results[2],events:nativeEvents}]},true))throw new Error('Actual HTML denial admission self-test failed');
  const dialogText='TM_LOADER_DIALOG_DISMISSED\nError launching app\nCannot find module <synthetic>/main.cjs';
  const dialogProof=classifyEntrypointDenial('main.cjs',{status:1,dialog:{state:'NAMED_DISMISSED',text:dialogText}},[],true,true);
  if(!namedLoaderDialogText(dialogText.replace('Error launching app','A JavaScript error occurred in the main process'))||dialogProof.verdict!=='PASS'||dialogProof.loaderDiagnostic.surface!=='OWNED_NATIVE_ERROR_DIALOG'||namedLoaderDialogText('TM_LOADER_DIALOG_DISMISSED\nWindows protected your PC\nmain.cjs')||classifyEntrypointDenial('main.cjs',{status:1,dialog:{state:'UNAVAILABLE',text:dialogText}},[],true,true).verdict!=='FAIL')throw new Error('Loader dialog observer contract self-test failed');
  if(!validateDamagedEntrypoints(damaged)||validateDamagedEntrypoints({...damaged,results:[damaged.results[0]]})||validateDamagedEntrypoints({...damaged,results:damaged.results.map(x=>({...x,copyRestored:false}))})||validateDamagedEntrypoints({...damaged,results:[damaged.results[0],{...damaged.results[1],loaderNamed:false}]}))throw new Error('Damaged entrypoint proof contract self-test failed');
  for(const result of [{status:null,signal:'SIGKILL'},{status:1,stderr:'unknown failure'},{status:1,stderr:'Cannot find module main.cjs',error:{code:'ETIMEDOUT'}}])if(classifyEntrypointDenial('main.cjs',result,[],true,true).verdict!=='FAIL')throw new Error('Unproven loader denial accepted');
  const ownershipRoot=fs.mkdtempSync(path.join(os.tmpdir(),'tm-owned-fixture-contract-'));
  try{
   const file=path.join(ownershipRoot,'copy.asar'),moved=path.join(ownershipRoot,'moved.asar'),linked=path.join(ownershipRoot,'linked.asar');
   const original=Buffer.from('original'),changed=Buffer.from('modified');fs.writeFileSync(file,original);
   const owned=readOwnedFile(file,original.length);
   writeOwnedFixture(file,changed,owned.identity,original);
   if(!readOwnedFile(file,changed.length,owned.identity).bytes.equals(changed))throw new Error('Owned mutation self-test failed');
   writeOwnedFixture(file,original,owned.identity,changed);
   const rejects=(action)=>{let refused=false;try{action();}catch{refused=true;}if(!refused)throw new Error('Unsafe owned fixture accepted');};
   rejects(()=>readOwnedFile(file,original.length-1));
   let authorized=false;rejects(()=>writeOwnedFixture(file,changed,owned.identity,changed,()=>{authorized=true;}));if(authorized||!fs.readFileSync(file).equals(original))throw new Error('Changed prior bytes authorized mutation');
   fs.linkSync(file,linked);rejects(()=>readOwnedFile(linked,original.length));rejects(()=>writeOwnedFixture(file,changed,owned.identity,original));fs.unlinkSync(linked);
   fs.renameSync(file,moved);fs.writeFileSync(file,original);
   rejects(()=>writeOwnedFixture(file,changed,owned.identity,original));rejects(()=>readOwnedFile(file,original.length,owned.identity));
   if(!fs.readFileSync(file).equals(original)||!fs.readFileSync(moved).equals(original))throw new Error('Substituted fixture was modified');
  }finally{fs.rmSync(ownershipRoot,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
  const backupProof=Object.fromEntries(['png','jpeg','distinctLogo','issuedPdf','exactInventory','verifiedSecretExclusion','freshRestore','activeRestore','assetHashes','logicalRows','tamperRejected','verifiedList','rejectedList'].map(key=>[key,true]));
  if(!validateBackupCoverage(backupProof)||validateBackupCoverage({...backupProof,assetHashes:false})||validateBackupCoverage({...backupProof,verifiedList:false})||validateBackupCoverage({...backupProof,rejectedList:false})||!validateBackupCoverage({...backupProof,verifiedList:undefined,rejectedList:undefined},1))throw new Error('Backup coverage receipt contract self-test failed');
  const ready={elapsedMs:15000,title:'Electrical T&M',heading:'Local foundation cockpit',rootWidth:100,rootHeight:100,health:true};
  if(!validateStartupReadiness(ready)||validateStartupReadiness({...ready,elapsedMs:15001})||validateStartupReadiness({...ready,rootWidth:0})||validateStartupReadiness({...ready,health:false}))throw new Error('Readiness receipt contract self-test failed');
  const interruption={verdict:'PASS',exitCode:1,spawnFailed:false,missingActive:true,rescueUnchanged:true,safeEvents:true,namedFailure:true,noOpen:true,originalRecovered:true,events:[{event:'paths.prepare',state:'fail'}]};
  if(!validateInterruptedRestoreDenial(interruption)||validateInterruptedRestoreDenial({...interruption,missingActive:false})||validateInterruptedRestoreDenial({...interruption,rescueUnchanged:false})||validateInterruptedRestoreDenial({...interruption,events:[...interruption.events,{event:'sqlite.open',state:'begin'}]}))throw new Error('Interrupted restore receipt contract self-test failed');
  console.log('PASS: native smoke, lifecycle and adversarial receipt-contract cases (NO NATIVE EXECUTION CLAIMED)');
}else if(import.meta.url===pathToFileURL(path.resolve(process.argv[1]||'')).href){
  if(process.argv.includes('--check-damaged-entrypoints')){
   const file=process.argv[process.argv.indexOf('--check-damaged-entrypoints')+1];
   let smoke;try{smoke=JSON.parse(readOwnedFile(file,1024*1024).bytes.toString('utf8'));}catch{throw new Error('Unsafe or invalid native smoke receipt');}
   const report=smoke.lifecycle?.diagnosticDenials?.damagedEntrypoints;
   const verdict=validateDamagedEntrypoints(report,true)?'PASS':'FAIL';
   console.log(JSON.stringify({schema:'tm-native-entrypoint-admission-v1',verdict,receiptSha256:entryHash(Buffer.from(JSON.stringify(report??null))),note:'Admission of actual recorded launch results, not a separate launch or formal acceptance.'},null,2));
   process.exit(verdict==='PASS'?0:1);
  }
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
    delete smokeEnv.TM_LIFECYCLE_PROFILE;delete smokeEnv.TM_LIFECYCLE_STAGE;delete smokeEnv.TM_LIFECYCLE_NONCE;delete smokeEnv.TM_LIFECYCLE_DUPLICATE_PROBE;delete smokeEnv.TM_LIFECYCLE_RENDERER_CRASH_PROBE;delete smokeEnv.TM_LIFECYCLE_INVALID_RENDERER_PROBE;delete smokeEnv.TM_LIFECYCLE_ABNORMAL_PROBE;
    const {result,proof}=await runWithPortTrap(binary,smokeEnv);
    let receipt=null;
    try {receipt=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch{/* Absence is a failure. */}
    const portIsolation={...proof,packagedOrigin:receipt?.packagedOrigin??null,packagedHealth:receipt?.packagedHealth===true};
    const extended=validateExtendedCockpitReceipt(receipt?.cockpitFlow);
    let screenshotsValid=false;
    if(extended){
      const images=receipt.cockpitFlow.layouts.map(x=>({shot:x.screenshot,bytes:fs.readFileSync(path.join(evidenceDir,x.screenshot.name))}));
      screenshotsValid=images.every(x=>validateCockpitPng(x.bytes,x.shot));
      const target=process.env.TM_NATIVE_SCREENSHOT_DIR;
      if(screenshotsValid&&target){
        const real=fs.realpathSync(target),approved=path.resolve(root,'.local-evidence');
        if(!path.relative(fs.realpathSync(approved),real).match(/^native-[^/\\]+[\\/]screenshots$/))throw new Error('Unapproved native screenshot evidence destination');
        for(const {shot,bytes} of images)fs.writeFileSync(path.join(real,shot.name),bytes,{flag:'wx',mode:0o600});
      }
    }
    const verified=validateNativeSmokeReceipt(receipt)&&validatePortIsolation(portIsolation)&&validateStartupReadiness(receipt?.startupReadiness)&&extended&&screenshotsValid&&validateBackupCoverage(receipt?.backupCoverage);
    const smokeSuccess=result.status===0&&!result.error&&verified;
    let rawIpc=null;
    if(smokeSuccess){
     const rawPath=path.join(evidenceDir,'raw-ipc.json');
     const rawResult=await spawnCaptured(binary,['--tm-smoke','--tm-raw-ipc-proof'],{...smokeEnv,TM_SMOKE_REPORT_PATH:rawPath});
     let rawReceipt=null;try{rawReceipt=JSON.parse(fs.readFileSync(rawPath,'utf8'));}catch{/* Absence is failure. */}
     rawIpc={exitCode:rawResult.status,spawnFailed:!!rawResult.error,receipt:rawReceipt};
    }
    const lifecycle=smokeSuccess?await runLifecycle(binary):null;
    const success=smokeSuccess&&rawIpc?.exitCode===0&&!rawIpc.spawnFailed&&validateRawIpcProof(rawIpc.receipt)&&lifecycle?.verdict==='PASS';
    const binarySha256=crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
    const sanitize=s=>String(s||'').replaceAll(os.homedir(),'<HOME>')
      .replace(/\b(?:sk-ant-|sk-proj-)[A-Za-z0-9_-]{12,}\b/gi,'<REDACTED_SECRET>');
    console.log(JSON.stringify({schema:'tm-native-smoke-runner-v3',platform:process.platform,arch:process.arch,
      binarySha256,exitCode:result.status,signal:result.signal,verdict:success?'PASS':'FAIL',
      checks:receipt?.passed||[],failedCheck:receipt?.failed||(!verified?'missing-or-invalid-report':lifecycle?.verdict==='FAIL'?'full-process-lifecycle':!validateRawIpcProof(rawIpc?.receipt)?'raw-ipc':null),
      lifecycle,cockpitFlow:receipt?.cockpitFlow??null,cockpitStage:receipt?.cockpitStage??null,cockpitDiagnostics:receipt?.cockpitDiagnostics??null,rendererSecurity:receipt?.rendererSecurity??null,portIsolation,rawIpc,startupReadiness:receipt?.startupReadiness??null,backupCoverage:receipt?.backupCoverage??null,
      note:'PACKAGED, ISOLATED, SYNTHETIC test only. Other Phase 2 acceptance/reviews remain open.',
      diagnosticTail:success?null:sanitize(((result.stdout||'')+'\n'+(result.stderr||'')).slice(-1200)),
      error:result.error?sanitize(result.error.message):null},null,2));
    if(!success)process.exitCode=1;
  } finally {
    fs.rmSync(evidenceDir,{recursive:true,force:true});
  }
}
}
