import fs from 'node:fs';
import path from 'node:path';
/** Structured local diagnostics. No secrets, customer fields or arbitrary filenames are emitted. */
const SAFE_EVENT=/^[a-z][a-z0-9.-]{1,80}$/;
export type StartupEvent={atUtc:string;event:string;state:'begin'|'pass'|'fail'|'info'};
export function createStartupRecorder(userDataRoot:string){
 const file=path.join(userDataRoot,'diagnostics','startup.jsonl');
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 return {
  file,
  record(event:string,state:StartupEvent['state']){
   if(!SAFE_EVENT.test(event))throw new Error('Invalid diagnostic event identifier');
   const line:StartupEvent={atUtc:new Date().toISOString(),event,state};
   fs.appendFileSync(file,JSON.stringify(line)+'\n',{encoding:'utf8',mode:0o600});
  }
 };
}
