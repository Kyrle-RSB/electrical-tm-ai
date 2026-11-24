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
