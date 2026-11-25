import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type {FileHandle} from 'node:fs/promises';
import {backup,DatabaseSync} from 'node:sqlite';
import { LocalStore } from '../../persistence-sqlite/src/connection';
import {canonicalBackupPath,backupPathsOverlap,bindDirectory} from './backup-destination';
import {assertReferencedEvidence,validateManifest,type Manifest} from './backup-manifest';
export type {Manifest} from './backup-manifest';
/** Use a single opened regular file for reading, copying and hashing. Refuse linked
 * objects and observable identity/content changes. This does not secure hostile same-user directory races. */
async function withRegularSource<T>(file:string,work:(handle:FileHandle,stat:fs.Stats)=>Promise<T>):Promise<T>{
 const handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{
  const opened=await handle.stat();
  const assertIdentity=async()=>{
   const current=await handle.stat(),named=await fs.promises.lstat(file);
   if(!current.isFile()||!named.isFile()||named.isSymbolicLink()||current.nlink!==1||named.nlink!==1||current.dev!==named.dev||current.ino!==named.ino||current.size!==opened.size||current.mtimeMs!==opened.mtimeMs||current.size!==named.size||current.mtimeMs!==named.mtimeMs)throw new Error('Unsafe or changed regular backup file');
  };
  await assertIdentity();const result=await work(handle,opened);await assertIdentity();return result;
 }finally{await handle.close();}
}
export async function hashFile(file:string,expectedBytes?:number):Promise<string>{
 return withRegularSource(file,async(handle,stat)=>{
  if(expectedBytes!==undefined&&stat.size!==expectedBytes)throw new Error('Backup integrity failure: size mismatch');
  const hash=crypto.createHash('sha256');let bytes=0;
  for await(const chunk of handle.createReadStream({autoClose:false})){bytes+=chunk.length;if(bytes>stat.size)throw new Error('Changed backup file');hash.update(chunk);}
  if(bytes!==stat.size)throw new Error('Changed backup file');return hash.digest('hex');
 });
}
export async function readBoundedBackupFile(file:string,limit:number):Promise<Buffer>{
 return withRegularSource(file,async(handle,stat)=>{
  if(stat.size>limit)throw new Error('Backup manifest exceeds size limit');
  const bytes=Buffer.alloc(stat.size);let offset=0;
  while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)throw new Error('Changed backup manifest');offset+=bytesRead;}
  return bytes;
 });
}
export async function copyRegularBackupFile(source:string,dest:string):Promise<void>{
 const checkSource=await bindDirectory(path.dirname(source)),checkDest=await bindDirectory(path.dirname(dest));
 if(!checkSource||!checkDest)throw new Error('Backup copy directory unavailable');
 return withRegularSource(source,async(handle,stat)=>{
  await checkSource();await checkDest();
  const output=await fs.promises.open(dest,'wx+',0o600);
  try{
   const original=await output.stat();
   const checkOutput=async()=>{
    await checkDest();const named=await fs.promises.lstat(dest),opened=await output.stat();
    if(!named.isFile()||named.isSymbolicLink()||!opened.isFile()||named.nlink!==1||opened.nlink!==1||opened.dev!==original.dev||opened.ino!==original.ino||named.dev!==original.dev||named.ino!==original.ino)throw new Error('Unsafe backup copy destination changed');
    return opened;
   };
   await checkOutput();await checkSource();
   let bytes=0;
   for await(const chunk of handle.createReadStream({autoClose:false})){
    if(bytes+chunk.length>stat.size)throw new Error('Changed backup file');
    await checkSource();await checkOutput();let offset=0;
    while(offset<chunk.length){const {bytesWritten}=await output.write(chunk,offset,chunk.length-offset,bytes+offset);if(!bytesWritten)throw new Error('Short backup write');offset+=bytesWritten;}
    bytes+=chunk.length;
   }
   if(bytes!==stat.size)throw new Error('Changed backup file');
   await output.sync();if((await checkOutput()).size!==bytes)throw new Error('Changed backup copy size');await checkSource();
  }finally{await output.close();}
 });
}
export async function traverseRegularFiles(root:string,rel=''):Promise<string[]> {
  // A managed folder itself may be a symlink/junction, not just its children.
  // Never traverse it, even if all of its descendants are ordinary files.
  const current=path.join(root,rel);
  let stat:fs.Stats;
  try{stat=await fs.promises.lstat(current);}
  catch(error){if(!rel&&(error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Unsupported filesystem object in data vault');
  const output:string[]=[];
  for(const entry of await fs.promises.readdir(path.join(root,rel),{withFileTypes:true})){
    if(entry.isSymbolicLink()||(!entry.isDirectory()&&!entry.isFile()))throw new Error('Unsupported filesystem object in data vault');
    const r=path.join(rel,entry.name);
    if(entry.isDirectory())output.push(...await traverseRegularFiles(root,r));else output.push(r);
  }
  return output;
}
/** Single-operator proof. App-level write mutex required for full product backup consistency. */
export async function createBackup(store:LocalStore,dataRoot:string,backupDestination:string):Promise<{backupPath:string;manifest:Manifest}> {
  const rootStat=await fs.promises.lstat(dataRoot);
  if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw new Error('Unsupported filesystem object in data vault');
  dataRoot=await canonicalBackupPath(dataRoot);
  backupDestination=await canonicalBackupPath(backupDestination);
  if(backupPathsOverlap(dataRoot,backupDestination))throw new Error('Backup destination must be outside data directory');
  await fs.promises.mkdir(backupDestination,{recursive:true,mode:0o700});
  const name=`tm-backup-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(3).toString('hex')}`;
  const temp=path.join(backupDestination,`.${name}.incomplete`), finished=path.join(backupDestination,name);
  await fs.promises.mkdir(temp,{mode:0o700});
  const checkStage=await bindDirectory(temp);if(!checkStage)throw new Error('Backup stage unavailable');
  try {
    await checkStage();await fs.promises.mkdir(path.join(temp,'db'));
    await checkStage();await backup(store.db,path.join(temp,'db','app.sqlite'));
    for(const folder of ['vault','artifacts']){
      const source=path.join(dataRoot,folder);
      for(const relative of await traverseRegularFiles(source)){
        await checkStage();const dest=path.join(temp,folder,relative);
        await fs.promises.mkdir(path.dirname(dest),{recursive:true});
        await checkStage();await copyRegularBackupFile(path.join(source,relative),dest);
      }
    }
    await checkStage();const manifest:Manifest={schema:'tm-phase1-backup-v1',createdUtc:new Date().toISOString(),files:[],excluded:['OS-protected secrets','secret_references','temporary files']};
    for(const relative of await traverseRegularFiles(temp)){
      if(relative==='manifest.json')continue;
      const filepath=path.join(temp,relative);
      manifest.files.push({path:relative.split(path.sep).join('/'),bytes:(await fs.promises.stat(filepath)).size,sha256:await hashFile(filepath)});
    }
    manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
    validateManifest(manifest);
    // Read a disposable copy: opening a WAL database may create sidecars even read-only.
    const inspectionDir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'tm-backup-inspect-'));
    try{
      const copy=path.join(inspectionDir,'app.sqlite');
      await copyRegularBackupFile(path.join(temp,'db','app.sqlite'),copy);
      const snapshot=new DatabaseSync(copy,{readOnly:true});
      try{assertReferencedEvidence(snapshot,manifest);}finally{snapshot.close();}
    }finally{await fs.promises.rm(inspectionDir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
    await checkStage();await fs.promises.writeFile(path.join(temp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
    await checkStage();await fs.promises.rename(temp,finished);
    return {backupPath:finished,manifest};
  }catch(e){
    try{await checkStage();await fs.promises.rm(temp,{recursive:true,force:true});}
    catch(cleanup){throw new AggregateError([e,cleanup],'Backup failed; unverified stage retained for recovery');}
    throw e;
  }
}
