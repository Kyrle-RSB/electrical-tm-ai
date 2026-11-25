import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ensureOwnedDirectory} from './os/paths';
/** Structured local diagnostics. No secrets, customer fields or arbitrary filenames are emitted. */
const SAFE_EVENT=/^[a-z][a-z0-9.-]{1,80}$/;
/** Validate the object actually opened, then verify the path still names it. */
function ownedDescriptor(file:string,fd:number,maxBytes?:number):fs.Stats{
 const opened=fs.fstatSync(fd),named=fs.lstatSync(file);
 if(!opened.isFile()||!named.isFile()||named.isSymbolicLink()||opened.nlink!==1||named.nlink!==1||opened.dev!==named.dev||opened.ino!==named.ino||opened.size!==named.size||opened.mtimeMs!==named.mtimeMs||opened.ctimeMs!==named.ctimeMs||(maxBytes!==undefined&&opened.size>maxBytes))throw new Error('Unsafe or changed file identity');
 return opened;
}
function readProofJson(file:string,maxBytes:number,label:string,checkProfile:()=>void):unknown{
 let fd:number|undefined;
 try{
  checkProfile();
  fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
  const opened=ownedDescriptor(file,fd,maxBytes);checkProfile();
  const bytes=Buffer.alloc(opened.size);
  let offset=0;while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(n===0)throw new Error('Changed proof file');offset+=n;}
  const after=ownedDescriptor(file,fd,maxBytes);if(after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs)throw new Error('Changed proof file');
  checkProfile();return JSON.parse(bytes.toString('utf8'));
 }catch{throw new Error(label);}finally{if(fd!==undefined)fs.closeSync(fd);}
}
export type StartupEvent={atUtc:string;event:string;state:'begin'|'pass'|'fail'|'info'};
export function createStartupRecorder(userDataRoot:string){
 const file=path.join(userDataRoot,'diagnostics','startup.jsonl');
 ensureOwnedDirectory(userDataRoot);
 ensureOwnedDirectory(path.dirname(file));
 const directories=[userDataRoot,path.dirname(file)].map(directory=>({directory,identity:fs.lstatSync(directory)}));
 const checkDirectories=()=>{for(const {directory,identity} of directories){const named=fs.lstatSync(directory);if(!named.isDirectory()||named.isSymbolicLink()||named.dev!==identity.dev||named.ino!==identity.ino)throw new Error('Unsafe diagnostic directory changed');}};
 checkDirectories();
 if(fs.existsSync(file)){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new Error('Unsafe diagnostic file');}
 return {
  file,
  record(event:string,state:StartupEvent['state']){
   if(!SAFE_EVENT.test(event))throw new Error('Invalid diagnostic event identifier');
   const line:StartupEvent={atUtc:new Date().toISOString(),event,state};
   checkDirectories();
   const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0),0o600);
   try{ownedDescriptor(file,fd);checkDirectories();fs.appendFileSync(fd,JSON.stringify(line)+'\n',{encoding:'utf8'});}finally{fs.closeSync(fd);}
  }
 };
}

export type LifecycleProof={profile:string;stage:'seed'|'reopen'|'revoked';nonce:string};
/** Only a runner-created synthetic temp directory may persist across proof launches. */
export function resolveLifecycleProof(env:NodeJS.ProcessEnv):LifecycleProof|null{
 const {TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:stage,TM_LIFECYCLE_NONCE:nonce}=env;
 if(profile===undefined&&stage===undefined&&nonce===undefined)return null;
 if(stage!=='seed'&&stage!=='reopen'&&stage!=='revoked')throw new Error('Invalid lifecycle stage');
 if(!nonce||!/^[a-f0-9]{32}$/.test(nonce))throw new Error('Invalid lifecycle nonce');
 if(!profile||!path.isAbsolute(profile)||!fs.existsSync(profile))throw new Error('Invalid lifecycle profile');
 const stat=fs.lstatSync(profile);
 if(stat.isSymbolicLink()||!stat.isDirectory()||(process.platform!=='win32'&&((stat.mode&0o077)!==0||stat.uid!==process.getuid?.())))throw new Error('Invalid lifecycle profile object');
 const real=fs.realpathSync(profile),tmp=fs.realpathSync(os.tmpdir()),relative=path.relative(tmp,real);
 if(!/^tm-native-lifecycle-[a-zA-Z0-9]+$/.test(relative))throw new Error('Invalid lifecycle profile root');
 const checkProfile=()=>{const current=fs.lstatSync(real);if(!current.isDirectory()||current.isSymbolicLink()||current.dev!==stat.dev||current.ino!==stat.ino||(process.platform!=='win32'&&((current.mode&0o077)!==0||current.uid!==process.getuid?.())))throw new Error('Invalid lifecycle profile identity');};
 const marker=path.join(real,'.tm-lifecycle.json');
 const value=readProofJson(marker,256,'Invalid lifecycle marker',checkProfile) as {schema?:string;nonce?:string}|null;
 if(value?.schema!=='tm-lifecycle-v1'||value.nonce!==nonce)throw new Error('Invalid lifecycle marker');
 const ownedRoots=['local-data','secrets','settings'];
 const visit=(p:string)=>{
  const st=fs.lstatSync(p);if(st.isSymbolicLink()||(!st.isFile()&&!st.isDirectory())||(st.isFile()&&st.nlink!==1))throw new Error('Invalid lifecycle profile object');
  if(st.isDirectory())for(const n of fs.readdirSync(p))visit(path.join(p,n));
 };
 if(stage==='seed'){
  if(ownedRoots.some(n=>fs.existsSync(path.join(real,n))))throw new Error('Lifecycle seed profile is not empty');
 }else{
  const prior=stage==='reopen'?'seed':'reopen';
  const receipt=path.join(real,`lifecycle-${prior}.json`);
  const previous=readProofJson(receipt,4096,'Invalid prior lifecycle receipt',checkProfile) as {schema?:string;nonce?:string;stage?:string;synthetic?:boolean}|null;
  if(!previous||previous.schema!=='tm-lifecycle-v1'||previous.nonce!==nonce||previous.stage!==prior||previous.synthetic!==true)throw new Error('Invalid prior lifecycle receipt');
  for(const name of ownedRoots){const item=path.join(real,name);if(fs.existsSync(item))visit(item);}
 }
 checkProfile();
 return {profile:real,stage,nonce};
}

/** Run the same orderly cleanup for failure and normal exit before native teardown.
 * Reentrant before-quit notifications cannot bypass the active drain. */
export function createShutdownCoordinator(deps:{drain:()=>Promise<void>;close:()=>void;record:(state:'pass'|'fail')=>void;quit:()=>void;exit:(code:1)=>void}){
 let failed=false,settled=false,active:Promise<void>|undefined;
 return {
  fail(){failed=true;if(!active&&!settled)deps.quit();},
  beforeQuit(preventDefault:()=>void){
   if(settled)return;
   preventDefault();if(active)return;
   active=(async()=>{
    try{await deps.drain();deps.close();deps.record('pass');}
    catch{failed=true;try{deps.record('fail');}catch{/* Unsafe diagnostics must not block termination. */}}
    // Leave the current native callback/microtask stack before invoking Electron teardown.
    await new Promise<void>(resolve=>setImmediate(resolve));
    settled=true;
    if(failed)deps.exit(1);else deps.quit();
   })();
  },
  wait(){return active??Promise.resolve();}
 };
}

export type RendererFailureEvent='renderer.load'|'renderer.preload'|'renderer.process';
/** Primary renderer failures are fatal, even when diagnostic storage is unavailable. */
export function createRendererFailureGate(deps:{record:(event:RendererFailureEvent,state:'fail')=>void;fail:()=>void}){
 let failed=false;
 return {fail(event:RendererFailureEvent){
  if(failed)return;failed=true;
  try{deps.record(event,'fail');}catch{/* Fail closed even if diagnostic storage is unsafe. */}
  deps.fail();
 },assertHealthy(){if(failed)throw new Error('Renderer unavailable');}};
}

/** Select the one renderer origin before any load. */
export function selectRendererUrl(packaged:boolean,devUrl:string|undefined):string{
 if(packaged&&devUrl!==undefined)throw new Error('Packaged renderer must not use a development URL');
 if(devUrl===undefined)return 'tmapp://app/index.html';
 let parsed:URL;
 try{parsed=new URL(devUrl);}catch{throw new Error('Invalid development renderer URL');}
 if(parsed.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||!parsed.port||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('Invalid development renderer URL');
 return parsed.href;
}
