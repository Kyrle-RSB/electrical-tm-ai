import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import { hashFile, traverseRegularFiles, Manifest } from './create-backup';
import { LocalStore } from '../../persistence-sqlite/src/connection';
import {canonicalBackupPath,backupPathsOverlap} from './backup-destination';
function isSafeRelative(p:string):boolean{
  if(!p||p.includes('\\')||path.posix.isAbsolute(p))return false;
  const normalized=path.posix.normalize(p);
  return normalized===p&&!p.startsWith('../')&&!p.includes('/../')&&!p.startsWith('./')&&p!=='..';
}
export async function verifyBackup(backupPath:string,migrationsDir?:string):Promise<Manifest>{
  const p=path.join(backupPath,'manifest.json');
  const m=JSON.parse(await fs.promises.readFile(p,'utf8')) as Manifest;
  if(m.schema!=='tm-phase1-backup-v1'||!Array.isArray(m.files)||m.files.length===0||m.files.length>10000)throw new Error('Unsupported backup manifest');
  if(typeof m.createdUtc!=='string'||!Array.isArray(m.excluded))throw new Error('Malformed backup metadata');
  const listed=new Set<string>();
  for(const entry of m.files){
    if(!entry||typeof entry.path!=='string'||!isSafeRelative(entry.path)||listed.has(entry.path))throw new Error('Unsafe backup manifest path');
    if(!/^(db\/app\.sqlite|vault\/.+|artifacts\/.+)$/.test(entry.path)||
      !Number.isSafeInteger(entry.bytes)||entry.bytes<0||typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/.test(entry.sha256))
      throw new Error('Malformed backup file entry');
    listed.add(entry.path);
    const actual=path.join(backupPath,entry.path);
    if((await fs.promises.lstat(actual)).isSymbolicLink())throw new Error('Backup contains symlink');
    const stat=await fs.promises.stat(actual);
    if(!stat.isFile()||stat.size!==entry.bytes||await hashFile(actual)!==entry.sha256)throw new Error(`Backup integrity failure: ${entry.path}`);
  }
  const onDisk=await traverseRegularFiles(backupPath);
  if(onDisk.length!==m.files.length+1||onDisk.some(f=>f!=='manifest.json'&&!listed.has(f.split(path.sep).join('/'))))throw new Error('Backup contains unexpected files');
  if(!listed.has('db/app.sqlite'))throw new Error('Backup missing SQLite database');
  // SQLite may create transient WAL/SHM files on open; inspect a disposable copy, not the archive itself.
  const tempDir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'tm-backup-verify-'));
  try{
    const copyPath=path.join(tempDir,'snapshot.sqlite');
    await fs.promises.copyFile(path.join(backupPath,'db','app.sqlite'),copyPath);
    const backupDb=new DatabaseSync(copyPath,{readOnly:true});
    try {
      const integrity=backupDb.prepare('PRAGMA quick_check').get() as {quick_check:string}|undefined;
      if(integrity?.quick_check!=='ok')throw new Error('Backup SQLite integrity check failed');
      if(backupDb.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup contains invalid foreign keys');
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
export async function restoreBackup(backupPath:string,activeRoot:string,migrationsDir?:string):Promise<{rollbackPath:string|null}> {
  const target=await canonicalBackupPath(activeRoot), source=await canonicalBackupPath(backupPath);
  if(backupPathsOverlap(target,source))throw new Error('Cannot restore onto backup');
  backupPath=source;
  const manifest=await verifyBackup(backupPath,migrationsDir);
  const parent=path.dirname(target);
  await fs.promises.mkdir(parent,{recursive:true});
  const nonce=crypto.randomBytes(5).toString('hex'),stage=path.join(parent,`.tm-restore-${nonce}`),rollback=path.join(parent,`.tm-rollback-${nonce}`);
  await fs.promises.mkdir(stage,{mode:0o700});
  let rolledBack=false;
  try{
    for(const entry of manifest.files){
      const dest=path.join(stage,entry.path);
      await fs.promises.mkdir(path.dirname(dest),{recursive:true});
      await fs.promises.copyFile(path.join(backupPath,entry.path),dest,fs.constants.COPYFILE_EXCL);
    }
    for(const entry of manifest.files) if(await hashFile(path.join(stage,entry.path))!==entry.sha256) throw new Error('Restore staging mismatch');
    if(fs.existsSync(target)){await fs.promises.rename(target,rollback);rolledBack=true;}
    try{await fs.promises.rename(stage,target);}catch(e){if(rolledBack)await fs.promises.rename(rollback,target);throw e;}
    return {rollbackPath:rolledBack?rollback:null};
  }catch(e){await fs.promises.rm(stage,{recursive:true,force:true});throw e;}
}
