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

test('owned paths reject redirected application database and diagnostic folders',async()=>{
 const {prepareApplicationPaths}=await import('../../apps/desktop/src/main/os/paths');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-app-paths-'));
 try{
  const root=path.join(dir,'profile'),outside=path.join(dir,'outside');fs.mkdirSync(outside);fs.mkdirSync(root);
  const config=prepareApplicationPaths(root,path.join(dir,'repo','apps','desktop'),path.join(dir,'resources'),true);
  assert.equal(config.migrations,path.join(dir,'resources','migrations'));
  assert.equal(config.database,path.join(root,'local-data','db','app.sqlite'));
  fs.symlinkSync(outside,path.join(root,'diagnostics'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>createStartupRecorder(root),/Unsafe application data directory/);
  assert.throws(()=>prepareApplicationPaths(root,dir,dir,true),/Unsafe application data directory/);
  assert.deepEqual(fs.readdirSync(outside),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('diagnostic append refuses a replaced hard-linked file and leaves unrelated bytes unchanged',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-diagnostic-race-'));
 try{
  const log=createStartupRecorder(path.join(dir,'profile'));log.record('startup.begin','begin');
  const outside=path.join(dir,'unrelated.txt');fs.writeFileSync(outside,'SYNTHETIC UNRELATED CONTENT');
  fs.unlinkSync(log.file);fs.linkSync(outside,log.file);
  assert.throws(()=>log.record('startup.finish','pass'),/Unsafe|changed/);
  assert.equal(fs.readFileSync(outside,'utf8'),'SYNTHETIC UNRELATED CONTENT');
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('lifecycle marker and prior receipt reject hardlinked external file identities',async()=>{
 const {resolveLifecycleProof}=await import('../../apps/desktop/src/main/bootstrap');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));const other=fs.mkdtempSync(path.join(os.tmpdir(),'tm-lifecycle-unrelated-'));
 const nonce='0123456789abcdef0123456789abcdef';const env={TM_LIFECYCLE_PROFILE:root,TM_LIFECYCLE_STAGE:'seed',TM_LIFECYCLE_NONCE:nonce};
 try{
  const marker=path.join(other,'marker.json');fs.writeFileSync(marker,JSON.stringify({schema:'tm-lifecycle-v1',nonce}));
  fs.linkSync(marker,path.join(root,'.tm-lifecycle.json'));assert.throws(()=>resolveLifecycleProof(env),/Invalid lifecycle marker/);
  fs.unlinkSync(path.join(root,'.tm-lifecycle.json'));fs.copyFileSync(marker,path.join(root,'.tm-lifecycle.json'));
  const receipt=path.join(other,'receipt.json');fs.writeFileSync(receipt,JSON.stringify({schema:'tm-lifecycle-v1',nonce,stage:'seed',synthetic:true}));
  fs.linkSync(receipt,path.join(root,'lifecycle-seed.json'));assert.throws(()=>resolveLifecycleProof({...env,TM_LIFECYCLE_STAGE:'reopen'}),/Invalid prior lifecycle receipt/);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});fs.rmSync(other,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('fatal startup shutdown drains once, blocks reentrant quit, and exits with code one after cleanup',async()=>{
 const {createShutdownCoordinator}=await import('../../apps/desktop/src/main/bootstrap');
 const events:string[]=[];let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 const controller=createShutdownCoordinator({drain:()=>{events.push('drain');return pending;},close:()=>{events.push('close');},record:state=>{events.push(state);},quit:()=>{events.push('quit');},exit:code=>{events.push(`exit:${code}`);}});
 const hold=()=>{events.push('prevent');};
 controller.fail();controller.beforeQuit(hold);controller.beforeQuit(hold);
 assert.deepEqual(events,['quit','prevent','drain','prevent']);
 release();await controller.wait();
 assert.deepEqual(events,['quit','prevent','drain','prevent','close','pass','exit:1']);
 controller.beforeQuit(hold);assert.equal(events.filter(e=>e==='drain').length,1);
});

test('orderly shutdown remains clean and cleanup errors force a single nonzero exit',async()=>{
 const {createShutdownCoordinator}=await import('../../apps/desktop/src/main/bootstrap');
 for(const failure of [false,true]){
  const events:string[]=[];
  const controller=createShutdownCoordinator({drain:async()=>{events.push('drain');},close:()=>{events.push('close');if(failure)throw new Error('synthetic cleanup');},record:state=>{events.push(state);},quit:()=>{events.push('quit');},exit:code=>{events.push(`exit:${code}`);}});
  controller.beforeQuit(()=>{events.push('prevent');});await controller.wait();
  assert.deepEqual(events,['prevent','drain','close',failure?'fail':'pass',failure?'exit:1':'quit']);
 }
});

test('lifecycle proof requires a private runner-owned temporary profile on POSIX',async()=>{
 const {resolveLifecycleProof}=await import('../../apps/desktop/src/main/bootstrap');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'));
 const nonce='0123456789abcdef0123456789abcdef',env={TM_LIFECYCLE_PROFILE:root,TM_LIFECYCLE_STAGE:'seed',TM_LIFECYCLE_NONCE:nonce};
 try{
  fs.writeFileSync(path.join(root,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{flag:'wx',mode:0o600});
  assert.equal(resolveLifecycleProof(env)?.profile,fs.realpathSync(root));
  if(process.platform!=='win32'){
   fs.chmodSync(root,0o777);assert.throws(()=>resolveLifecycleProof(env),/Invalid lifecycle profile/);
   fs.chmodSync(root,0o700);assert.equal(resolveLifecycleProof(env)?.profile,fs.realpathSync(root));
  }
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('primary renderer failure initiates a single fatal shutdown and blocks subsequent startup work',async()=>{
 const {createRendererFailureGate}=await import('../../apps/desktop/src/main/bootstrap');
 for(const event of ['renderer.load','renderer.preload','renderer.process'] as const){
  const calls:string[]=[];const gate=createRendererFailureGate({record:(e,s)=>calls.push(e+':'+s),fail:()=>calls.push('shutdown')});
  gate.assertHealthy();gate.fail(event);gate.fail('renderer.process');
  assert.deepEqual(calls,[event+':fail','shutdown']);assert.throws(()=>gate.assertHealthy(),/Renderer unavailable/);
 }
});

test('primary renderer failure still initiates fatal shutdown when safe diagnostics cannot be written',async()=>{
 const {createRendererFailureGate}=await import('../../apps/desktop/src/main/bootstrap');
 let calls=0;const gate=createRendererFailureGate({record:()=>{throw new Error('Synthetic diagnostic write failure');},fail:()=>{calls++;}});
 gate.fail('renderer.process');assert.equal(calls,1);assert.throws(()=>gate.assertHealthy(),/Renderer unavailable/);
});


test('renderer target rejects contaminated packaged and non-loopback development URLs before load',async()=>{
 const {selectRendererUrl}=await import('../../apps/desktop/src/main/bootstrap');
 assert.equal(selectRendererUrl(true,undefined),'tmapp://app/index.html');
 assert.equal(selectRendererUrl(false,'http://127.0.0.1:5173'),'http://127.0.0.1:5173/');
 assert.equal(selectRendererUrl(false,'http://localhost:51234/'),'http://localhost:51234/');
 assert.throws(()=>selectRendererUrl(true,'http://127.0.0.1:5173/'),/Packaged renderer/);
 for(const url of ['file:///tmp/fake.html','https://localhost:5173/','http://example.invalid:5173/','http://localhost:5173/other','http://user@localhost:5173/','http://localhost:5173/?x=1','http://localhost:5173/#x','http://localhost/'])assert.throws(()=>selectRendererUrl(false,url),/Invalid development renderer/);
});

test('interrupted restore with a rescue sibling cannot create a fresh missing active database on restart',async()=>{
 const {prepareApplicationPaths}=await import('../../apps/desktop/src/main/os/paths');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-restore-startup-'));
 try{
  const profile=path.join(root,'profile'),live=path.join(profile,'local-data'),rescue=path.join(profile,'.tm-rollback-1234567890');
  fs.mkdirSync(rescue,{recursive:true});fs.writeFileSync(path.join(rescue,'synthetic-marker'),'ORIGINAL');
  assert.throws(()=>prepareApplicationPaths(profile,root,root,true),/Restore recovery requires operator intervention/);assert.equal(fs.existsSync(live),false);assert.equal(fs.readFileSync(path.join(rescue,'synthetic-marker'),'utf8'),'ORIGINAL');
  const fresh=path.join(root,'fresh');assert.equal(prepareApplicationPaths(fresh,root,root,true).database,path.join(fresh,'local-data','db','app.sqlite'));
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('startup recorder refuses a substituted regular diagnostics directory',()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-diagnostic-dir-swap-'))),profile=path.join(root,'profile'),diagnostics=path.join(profile,'diagnostics'),parked=path.join(profile,'parked');
 try{
  const log=createStartupRecorder(profile);log.record('startup.begin','begin');const prior=fs.readFileSync(log.file);
  fs.renameSync(diagnostics,parked);fs.mkdirSync(diagnostics);
  assert.throws(()=>log.record('startup.finish','pass'),/Unsafe|changed/);
  assert.deepEqual(fs.readdirSync(diagnostics),[]);assert.deepEqual(fs.readFileSync(path.join(parked,'startup.jsonl')),prior);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('synthetic lifecycle admission refuses linked files inside its persistent data census',async()=>{
 const {resolveLifecycleProof}=await import('../../apps/desktop/src/main/bootstrap');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-lifecycle-linked-data-'));
 const nonce='0123456789abcdef0123456789abcdef',env={TM_LIFECYCLE_PROFILE:profile,TM_LIFECYCLE_STAGE:'reopen',TM_LIFECYCLE_NONCE:nonce};
 try{
  fs.writeFileSync(path.join(profile,'.tm-lifecycle.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{mode:0o600});
  fs.writeFileSync(path.join(profile,'lifecycle-seed.json'),JSON.stringify({schema:'tm-lifecycle-v1',nonce,stage:'seed',synthetic:true}),{mode:0o600});
  const directory=path.join(profile,'local-data');fs.mkdirSync(directory);const external=path.join(outside,'unrelated.txt');fs.writeFileSync(external,'SYNTHETIC EXTERNAL');
  fs.linkSync(external,path.join(directory,'linked.txt'));
  assert.throws(()=>resolveLifecycleProof(env),/Invalid lifecycle profile object/);assert.equal(fs.readFileSync(external,'utf8'),'SYNTHETIC EXTERNAL');
 }finally{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});fs.rmSync(outside,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('startup diagnostic append refuses regular-file substitution during open',()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-diagnostic-file-swap-'))),profile=path.join(root,'profile'),parked=path.join(root,'original.jsonl'),other=path.join(root,'other.jsonl');
 const open=fs.openSync;let injected=false;
 try{
  const log=createStartupRecorder(profile);log.record('startup.begin','begin');const prior=fs.readFileSync(log.file);
  const unrelated=Buffer.from('SYNTHETIC UNRELATED CONTENT');fs.writeFileSync(other,unrelated);
  fs.openSync=((...args:Parameters<typeof open>)=>{
   if(!injected&&String(args[0])===log.file){fs.renameSync(log.file,parked);fs.renameSync(other,log.file);injected=true;}
   return open(...args);
  }) as typeof open;
  assert.throws(()=>log.record('startup.finish','pass'),/Unsafe|changed/);assert.equal(injected,true);
  assert.deepEqual(fs.readFileSync(parked),prior);assert.deepEqual(fs.readFileSync(log.file),unrelated);
 }finally{fs.openSync=open;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('first diagnostic append refuses an exclusive-create collision and retains unrelated bytes',()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-diagnostic-collision-'))),open=fs.openSync;let injected=false;
 try{
  const log=createStartupRecorder(path.join(root,'profile'));const unrelated=Buffer.from('SYNTHETIC COLLISION');
  fs.openSync=((...args:Parameters<typeof open>)=>{
   if(!injected&&String(args[0])===log.file){injected=true;fs.writeFileSync(log.file,unrelated,{flag:'wx',mode:0o600});}
   return open(...args);
  }) as typeof open;
  assert.throws(()=>log.record('startup.begin','begin'),/EEXIST|Unsafe|changed/);assert.equal(injected,true);assert.deepEqual(fs.readFileSync(log.file),unrelated);
 }finally{fs.openSync=open;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('lifecycle proof opens existing marker and receipt read-only and never creates missing files',async()=>{
 const {resolveLifecycleProof}=await import('../../apps/desktop/src/main/bootstrap');
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'tm-native-lifecycle-'))),nonce='0123456789abcdef0123456789abcdef';
 const marker=path.join(root,'.tm-lifecycle.json'),receipt=path.join(root,'lifecycle-seed.json'),env={TM_LIFECYCLE_PROFILE:root,TM_LIFECYCLE_STAGE:'reopen',TM_LIFECYCLE_NONCE:nonce};
 const open=fs.openSync,observed:string[]=[];
 try{
  fs.openSync=((...args:Parameters<typeof open>)=>{
   if(String(args[0])===marker||String(args[0])===receipt){const flags=args[1];assert.equal(typeof flags,'number');assert.equal(args[2],0o600);assert.equal(Number(flags)&(fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_APPEND),0);observed.push(String(args[0]));}
   return open(...args);
  }) as typeof open;
  assert.throws(()=>resolveLifecycleProof(env),/Invalid lifecycle marker/);assert.deepEqual(fs.readdirSync(root),[]);
  fs.openSync=open;fs.writeFileSync(marker,JSON.stringify({schema:'tm-lifecycle-v1',nonce}),{flag:'wx',mode:0o600});
  const prior=fs.readFileSync(marker);
  // Reinstall the observer without intercepting synthetic fixture construction.
  const recordOpen=((...args:Parameters<typeof open>)=>{
   if(String(args[0])===marker||String(args[0])===receipt){const flags=args[1];assert.equal(typeof flags,'number');assert.equal(args[2],0o600);assert.equal(Number(flags)&(fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_APPEND),0);observed.push(String(args[0]));}
   return open(...args);
  }) as typeof open;
  fs.openSync=recordOpen;
  assert.throws(()=>resolveLifecycleProof(env),/Invalid prior lifecycle receipt/);assert.deepEqual(fs.readdirSync(root),['.tm-lifecycle.json']);
  fs.openSync=open;fs.writeFileSync(receipt,JSON.stringify({schema:'tm-lifecycle-v1',nonce,stage:'seed',synthetic:true}),{flag:'wx',mode:0o600});const previousReceipt=fs.readFileSync(receipt);
  fs.openSync=recordOpen;
  assert.equal(resolveLifecycleProof(env)?.stage,'reopen');
  assert.deepEqual(observed,[marker,marker,receipt,marker,receipt]);
  fs.openSync=open;assert.deepEqual(fs.readFileSync(marker),prior);assert.deepEqual(fs.readFileSync(receipt),previousReceipt);
 }finally{fs.openSync=open;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
