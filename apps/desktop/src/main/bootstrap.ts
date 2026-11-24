import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ensureOwnedDirectory} from './os/paths';
/** Structured local diagnostics. No secrets, customer fields or arbitrary filenames are emitted. */
const SAFE_EVENT=/^[a-z][a-z0-9.-]{1,80}$/;
export type StartupEvent={atUtc:string;event:string;state:'begin'|'pass'|'fail'|'info'};
export function createStartupRecorder(userDataRoot:string){
 const file=path.join(userDataRoot,'diagnostics','startup.jsonl');
 ensureOwnedDirectory(userDataRoot);
 ensureOwnedDirectory(path.dirname(file));
 if(fs.existsSync(file)){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new Error('Unsafe diagnostic file');}
 return {
  file,
  record(event:string,state:StartupEvent['state']){
   if(!SAFE_EVENT.test(event))throw new Error('Invalid diagnostic event identifier');
   const line:StartupEvent={atUtc:new Date().toISOString(),event,state};
   fs.appendFileSync(file,JSON.stringify(line)+'\n',{encoding:'utf8',mode:0o600});
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
 if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Invalid lifecycle profile object');
 const real=fs.realpathSync(profile),tmp=fs.realpathSync(os.tmpdir()),relative=path.relative(tmp,real);
 if(!/^tm-native-lifecycle-[a-zA-Z0-9]+$/.test(relative))throw new Error('Invalid lifecycle profile root');
 const marker=path.join(real,'.tm-lifecycle.json'),markerStat=fs.lstatSync(marker);
 if(!markerStat.isFile()||markerStat.isSymbolicLink()||markerStat.size>256)throw new Error('Invalid lifecycle marker');
 const value=JSON.parse(fs.readFileSync(marker,'utf8'));
 if(value?.schema!=='tm-lifecycle-v1'||value.nonce!==nonce)throw new Error('Invalid lifecycle marker');
 const ownedRoots=['local-data','secrets','settings'];
 const visit=(p:string)=>{
  const st=fs.lstatSync(p);if(st.isSymbolicLink()||(!st.isFile()&&!st.isDirectory()))throw new Error('Invalid lifecycle profile object');
  if(st.isDirectory())for(const n of fs.readdirSync(p))visit(path.join(p,n));
 };
 if(stage==='seed'){
  if(ownedRoots.some(n=>fs.existsSync(path.join(real,n))))throw new Error('Lifecycle seed profile is not empty');
 }else{
  const prior=stage==='reopen'?'seed':'reopen';
  const receipt=path.join(real,`lifecycle-${prior}.json`),st=fs.lstatSync(receipt);
  if(!st.isFile()||st.isSymbolicLink()||st.size>4096)throw new Error('Invalid prior lifecycle receipt');
  const previous=JSON.parse(fs.readFileSync(receipt,'utf8'));
  if(previous.schema!=='tm-lifecycle-v1'||previous.nonce!==nonce||previous.stage!==prior||previous.synthetic!==true)throw new Error('Invalid prior lifecycle receipt');
  for(const name of ownedRoots){const item=path.join(real,name);if(fs.existsSync(item))visit(item);}
 }
 return {profile:real,stage,nonce};
}
