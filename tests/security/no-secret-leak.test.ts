import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ProtectedSecretFile} from '../../apps/desktop/src/main/os/keychain';
const demoProvider={
 isAsyncEncryptionAvailable:async()=>true,
 encryptStringAsync:async(s:string)=>Buffer.from([...s].reverse().join(''),'utf8'),
 decryptStringAsync:async(buffer:Buffer)=>({result:[...buffer.toString()].reverse().join(''),shouldReEncrypt:false})
};
test('protected fake token never lands as plaintext, and revocation works',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-'));
 const file=path.join(folder,'probe.bin');try{
  const vault=new ProtectedSecretFile(demoProvider,file);
  await vault.storeFakeToken('TEST-FAKE-abc123');
  assert.equal(fs.readFileSync(file,'utf8').includes('TEST-FAKE-abc123'),false);
  assert.equal(await vault.readFakeToken(),'TEST-FAKE-abc123');
  const store=ProtectedSecretFile.createProviderStore(demoProvider,folder);
  await store.store('claude-api','synthetic-secret-not-for-real-use');
  assert.equal(await store.isConfigured('claude-api'),true);
  assert.equal(await store.read('claude-api'),'synthetic-secret-not-for-real-use');
  await store.revoke('claude-api');assert.equal(await store.read('claude-api'),null);
  await assert.rejects(store.store('../../../unsafe','anything'),/Unknown/);
  await vault.remove();assert.equal(await vault.exists(),false);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('unavailable vault fails closed, never writes a fallback plaintext file',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-off-'));
 try{const file=path.join(folder,'none.bin');
  const vault=new ProtectedSecretFile({...demoProvider,isAsyncEncryptionAvailable:async()=>false},file);
  await assert.rejects(vault.storeFakeToken('TEST-FAKE-example'),/fail closed/);
  assert.equal(fs.existsSync(file),false);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('persisted encrypted mock record fails closed on unavailable or damaged provider and remains revoked on reopen',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-reopen-'));
 try{
  const file=path.join(folder,'probe.bin');
  await new ProtectedSecretFile(demoProvider,file).storeFakeToken('TEST-FAKE-restart');
  const bytes=fs.readFileSync(file);
  assert.equal(await new ProtectedSecretFile(demoProvider,file).readFakeToken(),'TEST-FAKE-restart');
  const unavailable=new ProtectedSecretFile({...demoProvider,isAsyncEncryptionAvailable:async()=>false},file);
  await assert.rejects(unavailable.readFakeToken(),/fail closed/);
  assert.deepEqual(fs.readFileSync(file),bytes);
  const damaged=new ProtectedSecretFile({...demoProvider,decryptStringAsync:async()=>{throw new Error('Synthetic decryption failure');}},file);
  await assert.rejects(damaged.readFakeToken(),/decryption failure/);
  assert.deepEqual(fs.readFileSync(file),bytes);
  await damaged.remove();
  assert.equal(await new ProtectedSecretFile(demoProvider,file).exists(),false);
 }finally{fs.rmSync(folder,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('protected credential operations refuse redirected storage and preserve outside files',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-boundary-'));
 try{
  const outside=path.join(root,'outside');fs.mkdirSync(outside);
  const original=new ProtectedSecretFile(demoProvider,path.join(outside,'probe.bin'));
  await original.storeFakeToken('TEST-FAKE-original');
  const before=fs.readFileSync(path.join(outside,'probe.bin'));
  const linked=path.join(root,'secrets');fs.symlinkSync(outside,linked,process.platform==='win32'?'junction':'dir');
  const redirected=new ProtectedSecretFile(demoProvider,path.join(linked,'probe.bin'));
  await assert.rejects(redirected.exists(),/Unsafe credential storage/);
  await assert.rejects(redirected.readFakeToken(),/Unsafe credential storage/);
  await assert.rejects(redirected.storeFakeToken('TEST-FAKE-replacement'),/Unsafe credential storage/);
  await assert.rejects(redirected.remove(),/Unsafe credential storage/);
  assert.deepEqual(fs.readFileSync(path.join(outside,'probe.bin')),before);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});


test('asynchronous credential re-encryption cannot resurrect a revoked record',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-revoke-rotation-')),file=path.join(root,'probe.bin');
 try{
  await new ProtectedSecretFile(demoProvider,file).storeFakeToken('TEST-FAKE-revoked');
  let revoked=false;
  const vault=new ProtectedSecretFile({...demoProvider,decryptStringAsync:async(bytes:Buffer)=>{
   const value=await demoProvider.decryptStringAsync(bytes);fs.unlinkSync(file);revoked=true;return {...value,shouldReEncrypt:true};
  }},file);
  let failure:unknown;try{await vault.readFakeToken();}catch(error){failure=error;}
  assert.equal(revoked,true);assert.ok(failure instanceof Error,'revoked credential must not be returned');assert.match(failure.message,/credential storage file changed/);
  assert.equal(await vault.exists(),false);assert.deepEqual(fs.readdirSync(root),[]);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('protected credential read completes bounded short descriptor reads',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-short-read-')),file=path.join(root,'probe.bin');
 const nativeOpen=fs.promises.open;
 try{
  const vault=new ProtectedSecretFile(demoProvider,file);await vault.storeFakeToken('TEST-FAKE-partial-read');let reads=0;
  fs.promises.open=(async(...args:Parameters<typeof nativeOpen>)=>{
   const handle=await nativeOpen(...args);
   if(String(args[0])===file){const read=handle.read.bind(handle);handle.read=(async(buffer:Buffer,offset:number,length:number,position:number)=>{reads++;return read(buffer,offset,Math.min(length,3),position);}) as typeof handle.read;}
   return handle;
  }) as typeof nativeOpen;
  assert.equal(await vault.readFakeToken(),'TEST-FAKE-partial-read');assert.ok(reads>1);
 }finally{fs.promises.open=nativeOpen;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});


test('credential rotation succeeds for an unchanged record and fails closed if revoked during encryption',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-secret-rotate-')),file=path.join(root,'probe.bin');
 try{
  const original=new ProtectedSecretFile(demoProvider,file);await original.storeFakeToken('TEST-FAKE-rotation');
  let rotations=0;const rotate={...demoProvider,decryptStringAsync:async(bytes:Buffer)=>({...await demoProvider.decryptStringAsync(bytes),shouldReEncrypt:true}),encryptStringAsync:async(plain:string)=>{rotations++;return demoProvider.encryptStringAsync(plain);}};
  assert.equal(await new ProtectedSecretFile(rotate,file).readFakeToken(),'TEST-FAKE-rotation');assert.equal(rotations,1);assert.equal(await original.readFakeToken(),'TEST-FAKE-rotation');
  let revoked=false;const interrupted=new ProtectedSecretFile({...rotate,encryptStringAsync:async(plain:string)=>{fs.unlinkSync(file);revoked=true;return rotate.encryptStringAsync(plain);}},file);
  await assert.rejects(interrupted.readFakeToken(),/credential storage file changed/);assert.equal(revoked,true);assert.equal(await original.exists(),false);assert.deepEqual(fs.readdirSync(root),[]);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
