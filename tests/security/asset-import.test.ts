import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {importImageFromPickedFile} from '../../packages/asset-vault/src/import-file';
import {verifyManagedImage} from '../../packages/asset-vault/src/verify-image';
import {resolveManagedImage} from '../../packages/asset-vault/src/resolve-managed-asset';
test('managed receipt photograph is hash-verifiable and cannot escape vault',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-images-'));
 try{
  const source=path.join(home,'sample.png');fs.copyFileSync('tests/fixtures/synthetic-receipt.png',source);
  const vault=path.join(home,'vault'),receipt=await importImageFromPickedFile(source,vault);
  assert.equal((await verifyManagedImage(vault,receipt.relativePath,receipt.sha256)).mime,'image/png');
  assert.throws(()=>resolveManagedImage(vault,'../../.env'));
  assert.throws(()=>resolveManagedImage(vault,'images/other.png'));
  const file=resolveManagedImage(vault,receipt.relativePath);
  fs.appendFileSync(file,'tamper');await assert.rejects(verifyManagedImage(vault,receipt.relativePath,receipt.sha256),/hash mismatch/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('receipt import rejects an image swapped after lstat and before open (TOCTOU regression)',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-import-race-'));
 const selected=path.join(root,'chosen.png');
 fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);
 const nativeLstat=fs.promises.lstat;
 try{
   let substituted=false;
   fs.promises.lstat=(async (...args:Parameters<typeof fs.promises.lstat>)=>{
     const prior=await nativeLstat(...args);
     if(String(args[0])===selected&&!substituted){
       substituted=true;
       fs.renameSync(selected,path.join(root,'original-kept.png'));
       fs.copyFileSync(path.join(root,'original-kept.png'),selected);
     }
     return prior;
   }) as typeof fs.promises.lstat;
   await assert.rejects(()=>importImageFromPickedFile(selected,path.join(root,'vault')),
     /changed during secure import/);
   assert.equal(substituted,true);
 }finally{
   fs.promises.lstat=nativeLstat;
   fs.rmSync(root,{recursive:true,force:true});
 }
});

test('managed image import and verification reject redirected vault directories',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-boundary-'));
 try{
  const selected=path.join(home,'sample.png');fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);
  const outside=path.join(home,'outside'),receipt=await importImageFromPickedFile(selected,outside);
  const vault=path.join(home,'vault');fs.mkdirSync(vault);
  fs.symlinkSync(path.join(outside,'images'),path.join(vault,'images'),process.platform==='win32'?'junction':'dir');
  const before=fs.readdirSync(path.join(outside,'images'));
  await assert.rejects(importImageFromPickedFile(selected,vault),/Unsafe managed image directory/);
  await assert.rejects(verifyManagedImage(vault,receipt.relativePath,receipt.sha256),/Unsafe managed image directory/);
  assert.deepEqual(fs.readdirSync(path.join(outside,'images')),before);
  const alias=path.join(home,'alias');fs.symlinkSync(outside,alias,process.platform==='win32'?'junction':'dir');
  await assert.rejects(importImageFromPickedFile(selected,alias),/Unsafe managed image directory/);
 }finally{fs.rmSync(home,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('malformed image containers with matching superficial signatures are rejected',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-invalid-'));
 try{
  const valid=fs.readFileSync('tests/fixtures/synthetic-receipt.png');
  const corrupt=Buffer.from(valid);corrupt[29]^=1; // corrupt the IHDR checksum
  const bogusJpeg=Buffer.concat([Buffer.from([255,216]),Buffer.alloc(30),Buffer.from([255,217])]);
  for(const [name,bytes] of [['crc.png',corrupt],['fake.jpg',bogusJpeg]] as const){
   const selected=path.join(home,name);fs.writeFileSync(selected,bytes);
   await assert.rejects(importImageFromPickedFile(selected,path.join(home,'vault')),/PNG|JPEG/);
  }
  assert.equal(fs.existsSync(path.join(home,'vault')),false);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});


test('valid progressive JPEG is accepted and hash verified; oversized container rejected',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-jpeg-'));
 try{
  const selected=path.join(home,'sample.jpg');fs.writeFileSync(selected,Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/aAAwDAQACEAMQAAABmRQP/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=','base64'));
  const vault=path.join(home,'vault'),receipt=await importImageFromPickedFile(selected,vault);
  assert.equal(receipt.mime,'image/jpeg');
  assert.equal((await verifyManagedImage(vault,receipt.relativePath,receipt.sha256)).mime,'image/jpeg');
  const oversized=path.join(home,'large.jpg');fs.writeFileSync(oversized,Buffer.alloc(12*1024*1024+1));
  await assert.rejects(importImageFromPickedFile(oversized,vault),/regular permitted file/);
  assert.equal(fs.readdirSync(path.join(vault,'images')).length,1);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('receipt import and managed verification reject multiply-linked image identities',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-link-'));
 try{
  const selected=path.join(root,'picked.png'),alias=path.join(root,'alias.png'),vault=path.join(root,'vault');
  fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);fs.linkSync(selected,alias);
  await assert.rejects(importImageFromPickedFile(selected,vault),/regular permitted file|changed during secure import/);
  assert.equal(fs.existsSync(vault),false);fs.unlinkSync(alias);
  const receipt=await importImageFromPickedFile(selected,vault),managed=resolveManagedImage(vault,receipt.relativePath);
  fs.linkSync(managed,alias);
  await assert.rejects(verifyManagedImage(vault,receipt.relativePath,receipt.sha256),/regular permitted file|changed during secure import/);
  assert.deepEqual(fs.readFileSync(alias),fs.readFileSync(selected));
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('failed partial image import removes only its own incomplete file and retry verifies original content',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-partial-')),selected=path.join(root,'picked.png'),vault=path.join(root,'vault');
 const nativeOpen=fs.promises.open,nativeWrite=fs.promises.writeFile;
 try{
  fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);let injected=0;
  fs.promises.writeFile=(async(...args:Parameters<typeof nativeWrite>)=>{
   if(String(args[0]).includes(path.sep+'images'+path.sep)){injected++;await nativeWrite(args[0],Buffer.from('partial'),args[2]);throw Object.assign(new Error('Synthetic image disk full'),{code:'ENOSPC'});}return nativeWrite(...args);
  }) as typeof nativeWrite;
  fs.promises.open=(async(...args:Parameters<typeof nativeOpen>)=>{
   const handle=await nativeOpen(...args);
   if(String(args[0]).includes(path.sep+'images'+path.sep)&&String(args[1]).startsWith('wx')){const write=handle.writeFile.bind(handle);handle.writeFile=(async()=>{injected++;await write(Buffer.from('partial'));throw Object.assign(new Error('Synthetic image disk full'),{code:'ENOSPC'});}) as typeof handle.writeFile;}
   return handle;
  }) as typeof nativeOpen;
  await assert.rejects(importImageFromPickedFile(selected,vault),/disk full/);assert.equal(injected,1);assert.deepEqual(fs.readdirSync(path.join(vault,'images')),[]);
  fs.promises.open=nativeOpen;fs.promises.writeFile=nativeWrite;
  const receipt=await importImageFromPickedFile(selected,vault);assert.equal((await verifyManagedImage(vault,receipt.relativePath,receipt.sha256)).bytes,fs.statSync(selected).size);
 }finally{fs.promises.open=nativeOpen;fs.promises.writeFile=nativeWrite;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('image import rejects a redirected directory observed between vault validation and write',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-dir-race-')),selected=path.join(root,'picked.png'),vault=path.join(root,'vault'),images=path.join(vault,'images'),parked=path.join(vault,'parked'),outside=path.join(root,'outside');
 const nativeLstat=fs.promises.lstat;
 try{
  fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);fs.mkdirSync(images,{recursive:true});fs.mkdirSync(outside);let swapped=false;
  fs.promises.lstat=(async(...args:Parameters<typeof nativeLstat>)=>{const st=await nativeLstat(...args);if(!swapped&&String(args[0])===images){swapped=true;fs.renameSync(images,parked);fs.symlinkSync(outside,images,process.platform==='win32'?'junction':'dir');}return st;}) as typeof nativeLstat;
  let failure:unknown;try{await importImageFromPickedFile(selected,vault);}catch(error){failure=error;}
  assert.equal(swapped,true);assert.ok(failure instanceof Error);assert.match(failure.message,/Unsafe managed image directory/);assert.deepEqual(fs.readdirSync(outside),[]);assert.deepEqual(fs.readdirSync(parked),[]);
 }finally{fs.promises.lstat=nativeLstat;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('vault redirection at exclusive open never writes receipt bytes outside the selected owned directory',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-open-race-'))),selected=path.join(root,'picked.png'),vault=path.join(root,'vault'),images=path.join(vault,'images'),parked=path.join(vault,'parked'),outside=path.join(root,'outside');
 const open=fs.promises.open;let swapped=false;
 try{
  fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);fs.mkdirSync(images,{recursive:true});fs.mkdirSync(outside);
  fs.promises.open=(async(...args:Parameters<typeof open>)=>{if(!swapped&&path.dirname(String(args[0]))===images&&args[1]==='wx+'){swapped=true;fs.renameSync(images,parked);fs.symlinkSync(outside,images,process.platform==='win32'?'junction':'dir');}return open(...args);}) as typeof open;
  await assert.rejects(importImageFromPickedFile(selected,vault));assert.equal(swapped,true);
  assert.deepEqual(fs.readdirSync(parked),[]);
  // An exclusive create can leave an empty object during a hostile directory swap.
  // Never write sensitive content or delete the now-untrusted pathname.
  for(const name of fs.readdirSync(outside))assert.equal(fs.statSync(path.join(outside,name)).size,0,'receipt bytes escaped the vault');
 }finally{fs.promises.open=open;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('managed image verification refuses parent substitution before reading any bytes',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-image-read-parent-'))),selected=path.join(root,'picked.png'),vault=path.join(root,'vault'),images=path.join(vault,'images'),parked=path.join(vault,'parked');
 const lstat=fs.promises.lstat,open=fs.promises.open;let swapped=false,reads=0;
 try{
  fs.copyFileSync('tests/fixtures/synthetic-receipt.png',selected);
  const receipt=await importImageFromPickedFile(selected,vault),file=resolveManagedImage(vault,receipt.relativePath);
  const original=fs.readFileSync(file);
  fs.promises.lstat=(async(...args:Parameters<typeof lstat>)=>{
   if(!swapped&&String(args[0])===file){fs.renameSync(images,parked);fs.mkdirSync(images);fs.copyFileSync(path.join(parked,path.basename(file)),file);swapped=true;}
   return lstat(...args);
  }) as typeof lstat;
  fs.promises.open=(async(...args:Parameters<typeof open>)=>{const h=await open(...args);if(String(args[0])===file){const read=h.read.bind(h);h.read=(async(buffer:Buffer,offset:number,length:number,position:number)=>{reads++;return read(buffer,offset,length,position);}) as typeof h.read;}return h;}) as typeof open;
  await assert.rejects(verifyManagedImage(vault,receipt.relativePath,receipt.sha256),/directory changed/);
  assert.equal(swapped,true);assert.equal(reads,0,'redirected managed file was read before refusal');
  assert.deepEqual(fs.readFileSync(file),original);assert.deepEqual(fs.readFileSync(path.join(parked,path.basename(file))),original);
 }finally{fs.promises.lstat=lstat;fs.promises.open=open;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
