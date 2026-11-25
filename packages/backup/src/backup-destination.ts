import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/** Canonicalize even a not-yet-created destination using its nearest existing ancestor. */
export async function canonicalBackupPath(value:string):Promise<string>{
 let current=path.resolve(value);const tail:string[]=[];
 for(;;){
  try{return path.join(await fs.promises.realpath(current),...tail);}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
   const parent=path.dirname(current);if(parent===current)throw error;
   tail.unshift(path.basename(current));current=parent;
  }
 }
}
export function backupPathsOverlap(a:string,b:string):boolean{
 const key=(p:string)=>process.platform==='win32'||process.platform==='darwin'?p.toLowerCase():p;
 const contains=(parent:string,child:string)=>{
  const relative=path.relative(key(parent),key(child));
  return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));
 };
 return contains(a,b)||contains(b,a);
}
const MAX_PREFERENCE_BYTES=64*1024;
const missing=(error:unknown)=>(error as NodeJS.ErrnoException).code==='ENOENT';
function sameObject(a:fs.Stats,b:fs.Stats):boolean{
 return a.isFile()&&b.isFile()&&!a.isSymbolicLink()&&!b.isSymbolicLink()&&a.nlink===1&&b.nlink===1&&a.dev===b.dev&&a.ino===b.ino;
}
function sameFile(a:fs.Stats|null,b:fs.Stats|null):boolean{
 if(a===null||b===null)return a===b;
 return sameObject(a,b)&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
async function preferenceStat(file:string):Promise<fs.Stats|null>{
 try{const stat=await fs.promises.lstat(file);if(!sameObject(stat,stat))throw new Error('Unsafe backup location settings file');return stat;}
 catch(error){if(missing(error))return null;throw error;}
}
/** Bind the named directory to its observed identity. Do not claim an atomic filesystem lock. */
export async function bindDirectory(directory:string,create=false):Promise<(()=>Promise<void>)|null>{
 if(create)await fs.promises.mkdir(directory,{recursive:true,mode:0o700});
 let initial:fs.Stats;
 try{initial=await fs.promises.lstat(directory);}catch(error){if(!create&&missing(error))return null;throw error;}
 const verify=(stat:fs.Stats)=>{if(!stat.isDirectory()||stat.isSymbolicLink()||stat.dev!==initial.dev||stat.ino!==initial.ino)throw new Error('Unsafe backup location directory changed');};
 verify(initial);const canonical=await fs.promises.realpath(directory);
 const check=async()=>{verify(await fs.promises.lstat(directory));if(await fs.promises.realpath(directory)!==canonical)throw new Error('Unsafe backup location directory changed');};
 await check();return check;
}
async function readExact(handle:import('node:fs/promises').FileHandle,size:number):Promise<Buffer>{
 const bytes=Buffer.alloc(size);let offset=0;
 while(offset<size){const {bytesRead}=await handle.read(bytes,offset,size-offset,offset);if(!bytesRead)throw new Error('Backup location settings changed');offset+=bytesRead;}
 return bytes;
}
async function removeOwned(file:string,identity:fs.Stats,check:()=>Promise<void>):Promise<void>{
 await check();const named=await preferenceStat(file);if(named===null)return;
 if(!sameObject(identity,named))throw new Error('Unsafe backup location cleanup identity changed');
 await fs.promises.rm(file);
}
/** Non-secret, local-machine-only preference. It is deliberately not in a portable backup. */
export class BackupDestinationPreference {
 constructor(private readonly preferenceFile:string,private readonly dataRoot:string){}
 async get():Promise<string|null>{
  const check=await bindDirectory(path.dirname(this.preferenceFile));if(!check)return null;
  const before=await preferenceStat(this.preferenceFile);if(!before)return null;
  if(before.size>MAX_PREFERENCE_BYTES)throw new Error('Backup location settings exceed size limit');
  const handle=await fs.promises.open(this.preferenceFile,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
  let raw:string;
  try{
   const opened=await handle.stat();if(!sameFile(before,opened))throw new Error('Backup location settings changed');
   raw=(await readExact(handle,opened.size)).toString('utf8');
   await check();if(!sameFile(opened,await handle.stat())||!sameFile(opened,await preferenceStat(this.preferenceFile)))throw new Error('Backup location settings changed');
  }finally{await handle.close();}
  const x=JSON.parse(raw) as {version?:unknown;folder?:unknown}|null;
  if(x?.version!==1||typeof x.folder!=='string'||!path.isAbsolute(x.folder))throw new Error('Backup location settings are damaged; select a new folder');
  return x.folder;
 }
 async validate(folder:string):Promise<string>{
  if(!path.isAbsolute(folder))throw new Error('Backup folder must be an absolute path');
  const normalized=await fs.promises.realpath(folder);
  const root=await canonicalBackupPath(this.dataRoot);
  if(backupPathsOverlap(normalized,root))throw new Error('Choose a backup location separate from application data');
  const check=await bindDirectory(normalized);if(!check)throw new Error('Backup location must be a directory');
  const probe=path.join(normalized,`.tm-folder-check-${crypto.randomBytes(8).toString('hex')}`);
  let identity:fs.Stats|undefined;
  try{
   await check();const handle=await fs.promises.open(probe,'wx',0o600);
   try{identity=await handle.stat();await check();if(!sameObject(identity,identity))throw new Error('Unsafe backup location probe');}finally{await handle.close();}
   await removeOwned(probe,identity,check);
  }catch(error){
   if(identity){try{await removeOwned(probe,identity,check);}catch(cleanup){throw new AggregateError([error,cleanup],'Backup location probe failed; unverified file retained for recovery');}}
   throw error;
  }
  await check();
  if(backupPathsOverlap(normalized,await canonicalBackupPath(this.dataRoot)))throw new Error('Choose a backup location separate from application data');
  return normalized;
 }
 async set(folder:string):Promise<string>{
  const checked=await this.validate(folder);
  const check=await bindDirectory(path.dirname(this.preferenceFile),true);if(!check)throw new Error('Backup location settings directory unavailable');
  const before=await preferenceStat(this.preferenceFile);
  const bytes=Buffer.from(JSON.stringify({version:1,folder:checked})+'\n');
  if(bytes.length>MAX_PREFERENCE_BYTES)throw new Error('Backup location settings exceed size limit');
  const temporary=this.preferenceFile+`.tmp-${crypto.randomBytes(8).toString('hex')}`;
  let identity:fs.Stats|undefined;
  try{
   await check();const handle=await fs.promises.open(temporary,'wx+',0o600);
   try{
    identity=await handle.stat();if(!sameObject(identity,identity))throw new Error('Unsafe backup location stage');
    await check();await handle.writeFile(bytes);await handle.sync();
    const written=await handle.stat();if(!sameObject(identity,written)||written.size!==bytes.length||!(await readExact(handle,written.size)).equals(bytes))throw new Error('Backup location staged content changed');
    const after=await handle.stat();if(!sameFile(written,after))throw new Error('Backup location staged content changed');
    await check();if(!sameFile(after,await preferenceStat(temporary)))throw new Error('Backup location staged content changed');identity=after;
   }finally{await handle.close();}
   await check();if(!sameFile(before,await preferenceStat(this.preferenceFile))||!sameFile(identity,await preferenceStat(temporary)))throw new Error('Backup location settings changed');
   await check();await fs.promises.rename(temporary,this.preferenceFile);
  }catch(error){
   if(identity){try{await removeOwned(temporary,identity,check);}catch(cleanup){throw new AggregateError([error,cleanup],'Backup location update failed; unverified file retained for recovery');}}
   throw error;
  }
  return checked;
 }
}
