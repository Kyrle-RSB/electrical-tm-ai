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

test('backup preference refuses linked records and oversized settings without treating them as missing',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-backup-pref-links-'));
 try{
  const data=path.join(base,'data'),external=path.join(base,'external'),settings=path.join(base,'settings'),file=path.join(settings,'backup.json');fs.mkdirSync(data);fs.mkdirSync(external);fs.mkdirSync(settings);
  const other=path.join(base,'other.json'),bytes=JSON.stringify({version:1,folder:external});fs.writeFileSync(other,bytes);
  const pref=new BackupDestinationPreference(file,data);fs.linkSync(other,file);
  await assert.rejects(pref.get(),/Unsafe backup location/);assert.equal(fs.readFileSync(other,'utf8'),bytes);fs.unlinkSync(file);
  fs.writeFileSync(file,JSON.stringify({version:1,folder:external,padding:'x'.repeat(65536)}));
  await assert.rejects(pref.get(),/Backup location settings exceed/);
  // An explicitly selected new folder can repair a damaged ordinary setting.
  assert.equal(await pref.set(external),await fs.promises.realpath(external));assert.equal(await pref.get(),await fs.promises.realpath(external));
 }finally{fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('exclusive backup preference stage collision preserves unrelated object and previous selection',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-backup-pref-collision-'));
 const write=fs.promises.writeFile,open=fs.promises.open;
 try{
  const data=path.join(base,'data'),external=path.join(base,'external'),other=path.join(base,'other'),settings=path.join(base,'settings'),file=path.join(settings,'backup.json');for(const d of [data,external,other,settings])fs.mkdirSync(d);
  const pref=new BackupDestinationPreference(file,data);await pref.set(external);const previous=fs.readFileSync(file);let collision='';
  const inject=(p:unknown)=>{if(!collision&&path.basename(String(p)).startsWith('backup.json.tmp-')){collision=String(p);fs.writeFileSync(collision,'synthetic unrelated collision',{flag:'wx'});}};
  fs.promises.writeFile=(async(...args:Parameters<typeof write>)=>{inject(args[0]);return write(...args);}) as typeof write;
  fs.promises.open=(async(...args:Parameters<typeof open>)=>{inject(args[0]);return open(...args);}) as typeof open;
  await assert.rejects(pref.set(other),/EEXIST/);assert.ok(collision);assert.equal(fs.readFileSync(collision,'utf8'),'synthetic unrelated collision');assert.deepEqual(fs.readFileSync(file),previous);
 }finally{fs.promises.writeFile=write;fs.promises.open=open;fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('backup preference refuses same-size staging corruption and preserves prior selected folder',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-backup-pref-tamper-'));
 const write=fs.promises.writeFile,open=fs.promises.open;
 try{
  const data=path.join(base,'data'),external=path.join(base,'external'),other=path.join(base,'other'),settings=path.join(base,'settings'),file=path.join(settings,'backup.json');for(const d of [data,external,other,settings])fs.mkdirSync(d);
  const pref=new BackupDestinationPreference(file,data);await pref.set(external);const previous=fs.readFileSync(file);let injected=0;
  const isStage=(p:unknown)=>path.basename(String(p)).startsWith('backup.json.tmp-');
  fs.promises.writeFile=(async(...args:Parameters<typeof write>)=>{await write(...args);if(isStage(args[0])){const p=String(args[0]),b=fs.readFileSync(p);b[1]^=1;fs.writeFileSync(p,b);injected++;}}) as typeof write;
  fs.promises.open=(async(...args:Parameters<typeof open>)=>{const h=await open(...args);if(isStage(args[0])&&String(args[1]).startsWith('wx')){const sync=h.sync.bind(h);h.sync=async()=>{await h.write(Buffer.from([0]),0,1,1);injected++;await sync();};}return h;}) as typeof open;
  let failure:unknown;try{await pref.set(other);}catch(e){failure=e;}
  assert.equal(injected,1);assert.ok(failure instanceof Error,'corrupted stage must be refused');assert.match(failure.message,/Backup location.*changed/);assert.deepEqual(fs.readFileSync(file),previous);assert.deepEqual(fs.readdirSync(settings),['backup.json']);
 }finally{fs.promises.writeFile=write;fs.promises.open=open;fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('backup location settings reject a redirected settings directory and preserve unrelated files',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-backup-pref-dir-'));
 try{
  const data=path.join(base,'data'),external=path.join(base,'external'),outside=path.join(base,'outside'),settings=path.join(base,'settings');for(const d of [data,external,outside])fs.mkdirSync(d);
  const original=path.join(outside,'backup.json');fs.writeFileSync(original,JSON.stringify({version:1,folder:external}));const before=fs.readFileSync(original);
  fs.symlinkSync(outside,settings,process.platform==='win32'?'junction':'dir');
  const pref=new BackupDestinationPreference(path.join(settings,'backup.json'),data);
  await assert.rejects(pref.get(),/Unsafe backup location directory/);await assert.rejects(pref.set(external),/Unsafe backup location directory/);
  assert.deepEqual(fs.readFileSync(original),before);assert.deepEqual(fs.readdirSync(outside),['backup.json']);
 }finally{fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('backup location partial stage write and short reads preserve safe reselection and prior bytes',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-backup-pref-partial-'));
 const nativeOpen=fs.promises.open;
 try{
  const data=path.join(base,'data'),external=path.join(base,'external'),other=path.join(base,'other'),settings=path.join(base,'settings'),file=path.join(settings,'backup.json');for(const d of [data,external,other,settings])fs.mkdirSync(d);
  const pref=new BackupDestinationPreference(file,data);const initial=await pref.set(external);const previous=fs.readFileSync(file);let injected=0,reads=0;
  fs.promises.open=(async(...args:Parameters<typeof nativeOpen>)=>{const h=await nativeOpen(...args);if(path.basename(String(args[0])).startsWith('backup.json.tmp-')){h.writeFile=(async()=>{await h.write(Buffer.from('{partial'));injected++;throw Object.assign(new Error('Synthetic settings disk full'),{code:'ENOSPC'});}) as typeof h.writeFile;}return h;}) as typeof nativeOpen;
  await assert.rejects(pref.set(other),/disk full/);assert.equal(injected,1);assert.deepEqual(fs.readFileSync(file),previous);assert.deepEqual(fs.readdirSync(settings),['backup.json']);
  fs.promises.open=(async(...args:Parameters<typeof nativeOpen>)=>{const h=await nativeOpen(...args);if(path.basename(String(args[0]))==='backup.json'){const read=h.read.bind(h);h.read=(async(buffer:Buffer,offset:number,length:number,position:number)=>{reads++;return read(buffer,offset,Math.min(length,3),position);}) as typeof h.read;}return h;}) as typeof nativeOpen;
  assert.equal(await pref.get(),initial);assert.ok(reads>1);fs.promises.open=nativeOpen;
  const chosen=await pref.set(other);assert.equal(await pref.get(),chosen);
 }finally{fs.promises.open=nativeOpen;fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
