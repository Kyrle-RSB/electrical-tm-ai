import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import { hashFile, traverseRegularFiles, readBoundedBackupFile, copyRegularBackupFile } from './create-backup';
import {assertReferencedEvidence,validateManifest,backupManifestIdentity,type Manifest} from './backup-manifest';
import { LocalStore } from '../../persistence-sqlite/src/connection';
import {canonicalBackupPath,backupPathsOverlap} from './backup-destination';
export async function verifyBackup(backupPath:string,migrationsDir?:string):Promise<Manifest>{
  // Check the archive tree before opening its manifest or any listed content.
  const onDisk=await traverseRegularFiles(backupPath);
  if(!onDisk.includes('manifest.json'))throw new Error('Backup missing manifest');
  const p=path.join(backupPath,'manifest.json');
  const m=validateManifest(JSON.parse((await readBoundedBackupFile(p,8*1024*1024)).toString('utf8')));
  const listed=new Set(m.files.map(entry=>entry.path));
  for(const entry of m.files){
    const actual=path.join(backupPath,entry.path);
    if((await fs.promises.lstat(actual)).isSymbolicLink())throw new Error('Backup contains symlink');
    if(await hashFile(actual,entry.bytes)!==entry.sha256)throw new Error(`Backup integrity failure: ${entry.path}`);
  }
  if(onDisk.length!==m.files.length+1||onDisk.some(f=>f!=='manifest.json'&&!listed.has(f.split(path.sep).join('/'))))throw new Error('Backup contains unexpected files');
  if(!listed.has('db/app.sqlite'))throw new Error('Backup missing SQLite database');
  // SQLite may create transient WAL/SHM files on open; inspect a disposable copy, not the archive itself.
  const tempDir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'tm-backup-verify-'));
  try{
    const copyPath=path.join(tempDir,'snapshot.sqlite');
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
  }finally{await fs.promises.rm(tempDir,{recursive:true,force:true});}
  return m;
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
  let rolledBack=false;
  try{
    for(const entry of manifest.files){
      const dest=path.join(stage,entry.path);
      await fs.promises.mkdir(path.dirname(dest),{recursive:true});
      await copyRegularBackupFile(path.join(backupPath,entry.path),dest);
    }
    for(const entry of manifest.files) if(await hashFile(path.join(stage,entry.path),entry.bytes)!==entry.sha256) throw new Error('Restore staging mismatch');
    if(fs.existsSync(target)){await fs.promises.rename(target,rollback);rolledBack=true;}
    try{await fs.promises.rename(stage,target);}catch(e){if(rolledBack)await fs.promises.rename(rollback,target);throw e;}
    return {rollbackPath:rolledBack?rollback:null};
  }catch(e){await fs.promises.rm(stage,{recursive:true,force:true});throw e;}
}
