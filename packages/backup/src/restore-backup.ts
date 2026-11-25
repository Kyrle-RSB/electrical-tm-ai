import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import { hashFile, traverseRegularFiles, readBoundedBackupFile, copyRegularBackupFile } from './create-backup';
import {assertReferencedEvidence,validateManifest,backupManifestIdentity,type Manifest} from './backup-manifest';
import type {BackupListResult} from '../../contracts/src/ipc/settings.contract';
import { LocalStore } from '../../persistence-sqlite/src/connection';
import {canonicalBackupPath,backupPathsOverlap,bindDirectory} from './backup-destination';
export async function verifyBackup(backupPath:string,migrationsDir?:string):Promise<Manifest>{
  const checkArchive=await bindDirectory(backupPath);if(!checkArchive)throw new Error('Backup unavailable');
  // Check the archive tree before opening its manifest or any listed content.
  const onDisk=await traverseRegularFiles(backupPath);
  if(!onDisk.includes('manifest.json'))throw new Error('Backup missing manifest');
  await checkArchive();const p=path.join(backupPath,'manifest.json');
  const m=validateManifest(JSON.parse((await readBoundedBackupFile(p,8*1024*1024)).toString('utf8')));
  const listed=new Set(m.files.map(entry=>entry.path));
  for(const entry of m.files){
    await checkArchive();const actual=path.join(backupPath,entry.path);
    if((await fs.promises.lstat(actual)).isSymbolicLink())throw new Error('Backup contains symlink');
    if(await hashFile(actual,entry.bytes)!==entry.sha256)throw new Error(`Backup integrity failure: ${entry.path}`);
  }
  if(onDisk.length!==m.files.length+1||onDisk.some(f=>f!=='manifest.json'&&!listed.has(f.split(path.sep).join('/'))))throw new Error('Backup contains unexpected files');
  if(!listed.has('db/app.sqlite'))throw new Error('Backup missing SQLite database');
  // SQLite may create transient WAL/SHM files on open; inspect a disposable copy, not the archive itself.
  const tempDir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'tm-backup-verify-'));
  const checkTemp=await bindDirectory(tempDir);if(!checkTemp)throw new Error('Backup verification scratch unavailable');
  try{
    await checkArchive();await checkTemp();const copyPath=path.join(tempDir,'snapshot.sqlite');
    await copyRegularBackupFile(path.join(backupPath,'db','app.sqlite'),copyPath);
    const dbEntry=m.files.find(entry=>entry.path==='db/app.sqlite')!;
    if(await hashFile(copyPath,dbEntry.bytes)!==dbEntry.sha256)throw new Error('Backup SQLite copy changed');
    const backupDb=new DatabaseSync(copyPath,{readOnly:true});
    try {
      const integrity=backupDb.prepare('PRAGMA quick_check').get() as {quick_check:string}|undefined;
      if(integrity?.quick_check!=='ok')throw new Error('Backup SQLite integrity check failed');
      if(backupDb.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup contains invalid foreign keys');
      assertReferencedEvidence(backupDb,m);
      if(migrationsDir){
        const schemaTable=backupDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
        if(!schemaTable)throw new Error('Backup does not contain Fork B schema migration history');
      }
    }finally{backupDb.close();}
    if(migrationsDir){
      // Validate every installed migration checksum and pending upgrade on a disposable copy.
      // Do not apply migrations to the immutable backup archive itself.
      const preflight=new LocalStore(copyPath,migrationsDir);
      preflight.close();
    }
  }finally{await checkTemp();await fs.promises.rm(tempDir,{recursive:true,force:true});}
  await checkArchive();
  if(backupManifestIdentity(validateManifest(JSON.parse((await readBoundedBackupFile(p,8*1024*1024)).toString('utf8'))))!==backupManifestIdentity(m))throw new Error('Backup manifest changed during verification');
  return m;
}
/** Scan only immediate completed application-named archives in a trusted selected folder.
 * A list is an observed verification result, not authorization to restore or authenticate history. */
export async function listVerifiedBackups(folder:string,migrationsDir:string):Promise<BackupListResult>{
 const checkFolder=await bindDirectory(folder);if(!checkFolder)throw new Error('Backup location unavailable');
 const candidates:string[]=[];let scanned=0;
 const dir=await fs.promises.opendir(folder);
 for await(const entry of dir){
  if(++scanned>10000)throw new Error('Backup folder exceeds scan limit; select a smaller folder');
  if(/^tm-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{6}$/.test(entry.name)){
   candidates.push(entry.name);if(candidates.length>100)throw new Error('Backup folder exceeds archive scan limit; select a smaller folder');
  }
 }
 await checkFolder();const backups:BackupListResult['backups']=[];
 for(const id of candidates.sort().reverse()){
  await checkFolder();
  try{
   const selected=path.join(folder,id),checkArchive=await bindDirectory(selected);
   if(!checkArchive)throw new Error('Backup unavailable');
   const manifest=await verifyBackup(selected,migrationsDir);await checkArchive();await checkFolder();
   backups.push({id,status:'verified',createdUtc:new Date(manifest.createdUtc).toISOString(),fileCount:manifest.files.length,manifestIdentity:backupManifestIdentity(manifest)});
  }catch{await checkFolder();backups.push({id,status:'rejected'});}
 }
 await checkFolder();return {backups};
}
/** Close live SQLite connection before calling. Returns rollback directory to retain until user confirms. */
export async function restoreBackup(backupPath:string,activeRoot:string,migrationsDir?:string,expectedIdentity?:string):Promise<{rollbackPath:string|null}> {
  // Reject redirected managed directory objects before realpath can erase the link identity.
  for(const root of [backupPath,activeRoot]){
    try{const stat=await fs.promises.lstat(root);if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Unsupported filesystem object in restore root');}
    catch(error){if(root===activeRoot&&(error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  }
  const target=await canonicalBackupPath(activeRoot), source=await canonicalBackupPath(backupPath);
  if(backupPathsOverlap(target,source))throw new Error('Cannot restore onto backup');
  backupPath=source;
  const manifest=await verifyBackup(backupPath,migrationsDir);
  if(expectedIdentity!==undefined&&backupManifestIdentity(manifest)!==expectedIdentity)throw new Error('Backup changed after verification; select and verify it again');
  const parent=path.dirname(target);
  await fs.promises.mkdir(parent,{recursive:true});
  const nonce=crypto.randomBytes(5).toString('hex'),stage=path.join(parent,`.tm-restore-${nonce}`),rollback=path.join(parent,`.tm-rollback-${nonce}`);
  await fs.promises.mkdir(stage,{mode:0o700});
  const checkStage=await bindDirectory(stage);if(!checkStage)throw new Error('Restore stage unavailable');
  let rolledBack=false,preserveStage=false;
  try{
    for(const entry of manifest.files){
      await checkStage();const dest=path.join(stage,entry.path);
      await fs.promises.mkdir(path.dirname(dest),{recursive:true});
      await checkStage();await copyRegularBackupFile(path.join(backupPath,entry.path),dest);
    }
    await checkStage();for(const entry of manifest.files) if(await hashFile(path.join(stage,entry.path),entry.bytes)!==entry.sha256) throw new Error('Restore staging mismatch');
    await checkStage();if(fs.existsSync(target)){await fs.promises.rename(target,rollback);rolledBack=true;}
    try{await checkStage();await fs.promises.rename(stage,target);}catch(activationError){
      if(rolledBack){
        try{await fs.promises.rename(rollback,target);}
        catch(rollbackError){preserveStage=true;throw new AggregateError([activationError,rollbackError],'Restore recovery requires operator intervention');}
      }
      throw activationError;
    }
    return {rollbackPath:rolledBack?rollback:null};
  }catch(e){
    if(!preserveStage){try{await checkStage();await fs.promises.rm(stage,{recursive:true,force:true});}catch(cleanup){throw new AggregateError([e,cleanup],'Restore failed; unverified stage retained for recovery');}}
    throw e;
  }
}
