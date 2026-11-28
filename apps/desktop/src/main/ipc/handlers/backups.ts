import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {CHANNELS,assertNoPayload} from '../../../../../../packages/contracts/src';
import {LocalStore} from '../../../../../../packages/persistence-sqlite/src/connection';
import {createBackup} from '../../../../../../packages/backup/src/create-backup';
import {backupManifestIdentity} from '../../../../../../packages/backup/src/backup-manifest';
import {listVerifiedBackups,restoreBackup,verifyBackup} from '../../../../../../packages/backup/src/restore-backup';
import type {BackupPort} from '../../../../../../packages/application/src/ports/port-types';
import {bindDirectory,type BackupDestinationPreference} from '../../../../../../packages/backup/src/backup-destination';
import type {NativeFileDialogs} from '../../os/file-dialogs';
import type {ValidatedRegistrar} from '../register';
import {requireExistingDatabase} from '../../os/paths';
export interface BackupHandlerOptions{
 dialogs:Pick<NativeFileDialogs,'chooseFolder'|'confirmRestore'>;
 preference:Pick<BackupDestinationPreference,'get'|'set'|'validate'|'validateReadLocation'>;
 dataRoot:string;migrationsDir:string;
 getStore:()=>LocalStore;setStore:(store:LocalStore)=>void;
 /** A failed reopen must recover the old database; if that fails, disable the data owner. */
 reopen:()=>LocalStore;onFatalRecovery:()=>void;
}
/** All invocations are registered through the main process sender and operation-queue gate. */
export function registerBackupHandlers(register:ValidatedRegistrar,opts:BackupHandlerOptions){
 const {dialogs,preference,dataRoot,migrationsDir}=opts;
 const backups:BackupPort={
  create:folder=>createBackup(opts.getStore(),dataRoot,folder),
  list:folder=>listVerifiedBackups(folder,migrationsDir),
  verify:folder=>verifyBackup(folder,migrationsDir),
  restore:(folder,expectedIdentity)=>restoreBackup(folder,dataRoot,migrationsDir,expectedIdentity)
 };
 register(CHANNELS.backupGetLocation,assertNoPayload,async()=>({folder:await preference.get()}));
 register(CHANNELS.backupChooseLocation,assertNoPayload,async()=>{
  const folder=await dialogs.chooseFolder(true);return folder===null?null:{folder:await preference.set(folder)};
 });
 register(CHANNELS.backupCreateStored,assertNoPayload,async()=>{
  const folder=await preference.get();if(!folder)throw new Error('Select a backup folder before backing up');
  const checked=await preference.validate(folder);return backups.create(checked);
 });
 register(CHANNELS.backupCreate,assertNoPayload,async()=>{
  const selected=await dialogs.chooseFolder(true);if(selected===null)return null;
  return backups.create(await preference.set(selected));
 });
 register(CHANNELS.backupListVerified,assertNoPayload,async()=>{
  const folder=await preference.get();if(!folder)throw new Error('Select a backup folder before listing backups');
  return backups.list(await preference.validateReadLocation(folder));
 });
 register(CHANNELS.backupRestore,assertNoPayload,async()=>{
  const selected=await dialogs.chooseFolder(false);if(selected===null)return null;
  const expectedIdentity=backupManifestIdentity(await backups.verify(selected));
  if(!await dialogs.confirmRestore())return null;
  requireExistingDatabase(dataRoot);
  const checkOriginal=await bindDirectory(dataRoot);if(!checkOriginal)throw new Error('Restore recovery requires operator intervention');
  const originalIdentity=await fs.promises.lstat(dataRoot);
  await checkOriginal();
  opts.getStore().close();
  let restored:{rollbackPath:string|null}|null=null;
  try{
   restored=await backups.restore(selected,expectedIdentity);
   requireExistingDatabase(dataRoot);
   opts.setStore(opts.reopen());return {restored:true,rollbackPath:restored.rollbackPath};
  }catch(error){
   try{
    if(restored?.rollbackPath){
     const original=await fs.promises.lstat(restored.rollbackPath);
     if(!original.isDirectory()||original.isSymbolicLink()||original.dev!==originalIdentity.dev||original.ino!==originalIdentity.ino)throw new Error('Restore recovery directory changed');
     const failed=path.join(path.dirname(dataRoot),path.basename(dataRoot)+'.restore-failed-'+randomUUID());
     if(fs.existsSync(dataRoot))await fs.promises.rename(dataRoot,failed);
     await fs.promises.rename(restored.rollbackPath,dataRoot);
    }
    await checkOriginal();
    requireExistingDatabase(dataRoot);
    opts.setStore(opts.reopen());
   }catch(recoveryError){opts.onFatalRecovery();throw new AggregateError([error,recoveryError],'Restore recovery requires operator intervention');}
   throw error;
  }
 });
}
