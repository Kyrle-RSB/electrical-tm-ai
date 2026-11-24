import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {BackupDestinationPreference} from '../../packages/backup/src/backup-destination';
test('selected backup location is persisted and cannot point into app data',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-backup-folder-'));
 try{
  const data=path.join(base,'data'),backups=path.join(base,'external');
  fs.mkdirSync(data);fs.mkdirSync(backups);
  const pref=new BackupDestinationPreference(path.join(base,'settings','backup.json'),data);
  assert.equal(await pref.get(),null);
  const canonicalBackups=await fs.promises.realpath(backups);
  assert.equal(await pref.set(backups),canonicalBackups);assert.equal(await pref.get(),canonicalBackups);
  await assert.rejects(pref.set(data),/separate/);
  const inside=path.join(data,'child');fs.mkdirSync(inside);await assert.rejects(pref.set(inside),/separate/);
  const symlink=path.join(base,'alias');fs.symlinkSync(data,symlink);
  await assert.rejects(pref.set(symlink),/separate/);
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
