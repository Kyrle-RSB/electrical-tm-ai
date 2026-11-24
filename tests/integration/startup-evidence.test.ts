import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStartupRecorder} from '../../apps/desktop/src/main/bootstrap';
test('startup receipt records safe identifiers only and avoids arbitrary data leakage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-startup-'));
 try{
  const log=createStartupRecorder(dir);log.record('renderer.load','begin');log.record('renderer.load','pass');
  const lines=fs.readFileSync(log.file,'utf8').trim().split('\n').map(s=>JSON.parse(s));
  assert.deepEqual(lines.map(x=>[x.event,x.state]),[['renderer.load','begin'],['renderer.load','pass']]);
  assert.throws(()=>log.record('SECRET: abc','info'),/Invalid/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('lifecycle mode accepts only its own marked direct synthetic temp child',async()=>{
 const {resolveLifecycleProof}=await import('../../apps/desktop/src/main/bootstrap');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));
 const nonce='0123456789abcdef0123456789abcdef';
 const env={TM_LIFECYCLE_PROFILE:root,TM_LIFECYCLE_STAGE:'seed',TM_LIFECYCLE_NONCE:nonce};
 try{
  assert.throws(()=>resolveLifecycleProof(env),/marker|ENOENT/i);
  fs.writeFileSync(path.join(root,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}));
  assert.deepEqual(resolveLifecycleProof(env),{profile:fs.realpathSync(root),stage:'seed',nonce});
  assert.equal(resolveLifecycleProof({}),null);
  fs.mkdirSync(path.join(root,'local-data'));assert.throws(()=>resolveLifecycleProof(env),/seed profile is not empty/);
  fs.rmdirSync(path.join(root,'local-data'));
  assert.throws(()=>resolveLifecycleProof({...env,TM_LIFECYCLE_STAGE:'reopen'}),/receipt|ENOENT/i);
  assert.throws(()=>resolveLifecycleProof({...env,TM_LIFECYCLE_NONCE:'f'.repeat(32)}),/marker/i);
  assert.throws(()=>resolveLifecycleProof({...env,TM_LIFECYCLE_STAGE:'arbitrary'}),/stage/i);
  assert.throws(()=>resolveLifecycleProof({...env,TM_LIFECYCLE_PROFILE:os.tmpdir()}),/profile/i);
  const alias=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));fs.rmdirSync(alias);
  try{fs.symlinkSync(root,alias,process.platform==='win32'?'junction':'dir');assert.throws(()=>resolveLifecycleProof({...env,TM_LIFECYCLE_PROFILE:alias}),/profile/i);}
  finally{fs.rmSync(alias,{recursive:true,force:true});}
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
