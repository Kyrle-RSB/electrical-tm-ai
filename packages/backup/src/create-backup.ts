import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {backup,DatabaseSync} from 'node:sqlite';
import { LocalStore } from '../../persistence-sqlite/src/connection';
import {canonicalBackupPath,backupPathsOverlap} from './backup-destination';
import {assertReferencedEvidence,validateManifest,type Manifest} from './backup-manifest';
export type {Manifest} from './backup-manifest';
export async function hashFile(file:string):Promise<string>{
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
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
  try {
    await fs.promises.mkdir(path.join(temp,'db'));
    await backup(store.db,path.join(temp,'db','app.sqlite'));
    for(const folder of ['vault','artifacts']){
      const source=path.join(dataRoot,folder);
      for(const relative of await traverseRegularFiles(source)){
        const dest=path.join(temp,folder,relative);
        await fs.promises.mkdir(path.dirname(dest),{recursive:true});
        await fs.promises.copyFile(path.join(source,relative),dest,fs.constants.COPYFILE_EXCL);
      }
    }
    const manifest:Manifest={schema:'tm-phase1-backup-v1',createdUtc:new Date().toISOString(),files:[],excluded:['OS-protected secrets','secret_references','temporary files']};
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
      await fs.promises.copyFile(path.join(temp,'db','app.sqlite'),copy);
      const snapshot=new DatabaseSync(copy,{readOnly:true});
      try{assertReferencedEvidence(snapshot,manifest);}finally{snapshot.close();}
    }finally{await fs.promises.rm(inspectionDir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
    await fs.promises.writeFile(path.join(temp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
    await fs.promises.rename(temp,finished);
    return {backupPath:finished,manifest};
  }catch(e){await fs.promises.rm(temp,{recursive:true,force:true});throw e;}
}
