import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {assertEnvelope,createRequestReplayGuard,validateBusinessInput,validateProjectDetailsInput,validateProjectStatusInput,unwrapIpcResult,requestCorrelationId} from '../../packages/contracts/src/ipc/request-envelope';
test('owner-only form validators reject spoofed fields and unknown states',()=>{
 const good={legalName:'Demo Electric',tradeName:'D',phone:'',email:'',mailingAddress:'',taxId:'',contractorLicense:''};
 assert.equal(validateBusinessInput(good).legalName,'Demo Electric');
 assert.throws(()=>validateBusinessInput({...good,ownerRole:'admin'}));
 assert.throws(()=>validateBusinessInput({...good,legalName:''}));
 const id='aafad558-9329-4876-bd71-2de567501979';
 assert.equal(validateProjectStatusInput({id,status:'archived'}).status,'archived');
 assert.throws(()=>validateProjectStatusInput({id,status:'deleted'}));
 assert.throws(()=>validateProjectDetailsInput({id,name:'x',billingAddress:'y',notes:'',tenantId:'other'}));
});


test('versioned IPC envelopes reject malformed UUIDs, missing payloads and replayed operation IDs',()=>{
 const id='aafad558-9329-4876-bd71-2de567501979';
 assert.doesNotThrow(()=>assertEnvelope({requestId:id,version:1,payload:null}));
 for(const value of [{requestId:'--------------------',version:1,payload:null},{requestId:id,version:2,payload:null},{requestId:id,version:1},{requestId:id,payload:null}])assert.throws(()=>assertEnvelope(value));
 const claim=createRequestReplayGuard(2);
 claim(id);assert.throws(()=>claim(id),/duplicate/);
 claim('aafad558-9329-4876-bd71-2de567501978');
 assert.throws(()=>claim('aafad558-9329-4876-bd71-2de567501977'),/capacity/);
 assert.throws(()=>claim(id),/duplicate/);
 assert.throws(()=>validateProjectStatusInput({id,status:['active']}));
});

test('project identity validators reject 36-character non-UUID identifiers',()=>{
 assert.throws(()=>validateProjectStatusInput({id:'-'.repeat(36),status:'active'}),/Invalid project identity/);
 assert.throws(()=>validateProjectDetailsInput({id:'-'.repeat(36),name:'',billingAddress:'',notes:''}),/Invalid project identity/);
});


test('response validation rejects wrong correlation, unknown error codes and extra response fields',()=>{
 const id='aafad558-9329-4876-bd71-2de567501979',other='aafad558-9329-4876-bd71-2de567501978';
 const error={code:'SECURITY',message:'Rejected',retryable:false,correlationId:id};
 assert.equal(unwrapIpcResult({ok:true,requestId:id,data:'expected'},id),'expected');
 assert.throws(()=>unwrapIpcResult({ok:false,requestId:id,error},id),/SECURITY: Rejected/);
 for(const value of [{ok:false,requestId:other,error},{ok:false,requestId:id,error:{...error,correlationId:other}},{ok:false,requestId:id,error:{...error,code:'UNKNOWN'}},{ok:true,requestId:id,data:1,extra:true}])
  assert.throws(()=>unwrapIpcResult(value,id),/Invalid application response/);
 assert.equal(requestCorrelationId({requestId:id,payload:'untrusted'}),id);
 assert.equal(requestCorrelationId({requestId:'bad'}),null);
});
test('structured IPC envelope rejects cyclic, nonplain and oversized data before handler execution',()=>{
 const id='aafad558-9329-4876-bd71-2de567501979';const cycle:Record<string,unknown>={};cycle.loop=cycle;
 for(const payload of [cycle,new Date(),new Map(),1n,'x'.repeat(18000),{x:Infinity}])assert.throws(()=>assertEnvelope({requestId:id,version:1,payload}),/Invalid|exceeds/);
 assert.doesNotThrow(()=>assertEnvelope({requestId:id,version:1,payload:{code:'SYN',customer:'Demo',siteAddress:'Site'}}));
});

test('preload bridge is frozen and invokes only the fixed channel map',async()=>{
 const {createBridge}=await import('../../apps/desktop/src/preload/bridge');
 const {ALL_CHANNELS}=await import('../../packages/contracts/src/ipc/channel-map');
 const seen:string[]=[];
 const bridge=createBridge(async<T>(channel:string,_payload?:unknown):Promise<T>=>{seen.push(channel);return undefined as T;});
 assert.ok(Object.isFrozen(bridge));
 assert.equal('invoke' in bridge,false);
 const v={code:'SYN-002',customer:'Synthetic',siteAddress:'Site',details:{name:'Name',billingAddress:'Billing',notes:'Notes'}};
 const id='00000000-0000-4000-8000-000000000001';
 await bridge.ping();await bridge.createProject(v);await bridge.updateProject({id,...v});
 await bridge.listProjects();await bridge.listProjectsDetailed();await bridge.updateProjectDetails({id,...v.details});await bridge.setProjectStatus({id,status:'archived'});
 await bridge.getBusinessProfile();await bridge.updateBusinessProfile({legalName:'Synthetic',tradeName:'',phone:'',email:'',mailingAddress:'',taxId:'',contractorLicense:''});
 await bridge.getBusinessLogo();await bridge.chooseBusinessLogo();await bridge.removeBusinessLogo();
 await bridge.importReceiptImage();await bridge.saveSyntheticPdf();await bridge.chooseBackupFolderAndBackUp();await bridge.getBackupFolder();await bridge.chooseBackupFolder();await bridge.backUpToSelectedFolder();await bridge.listVerifiedBackups();await bridge.chooseBackupAndRestore();await bridge.storeFakeSecretProof();await bridge.checkFakeSecretProof();await bridge.removeFakeSecretProof();
 assert.deepEqual(seen,[...ALL_CHANNELS]);
});

test('native foreign-window fixture covers the exact fixed bridge method set',async()=>{
 const {PACKAGED_SECURITY_METHODS}=await import('../e2e/cockpit-flow.spec');
 const {createBridge}=await import('../../apps/desktop/src/preload/bridge');
 const bridge=createBridge(async()=>{throw new Error('No transport in method census');});
 assert.deepEqual([...PACKAGED_SECURITY_METHODS],Object.keys(bridge));
 assert.equal(new Set(PACKAGED_SECURITY_METHODS).size,PACKAGED_SECURITY_METHODS.length);
});


test('native proof preferences accessor fails closed instead of substituting configured values',async()=>{
 const {readPackagedRuntimePrefs}=await import('../e2e/cockpit-flow.spec');
 const observed={contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false};
 assert.throws(()=>readPackagedRuntimePrefs({}),/accessor unavailable/);
 assert.throws(()=>readPackagedRuntimePrefs({getLastWebPreferences:()=>null}),/preferences invalid/);
 assert.throws(()=>readPackagedRuntimePrefs({getLastWebPreferences:()=>({...observed,webSecurity:undefined})}),/missing runtime preference webSecurity/);
 assert.deepEqual(readPackagedRuntimePrefs({getLastWebPreferences:()=>observed}),observed);
});


test('packaged renderer isolation expression returns observations rather than calling an object',async()=>{
 const {RENDERER_ISOLATION_EXPRESSION}=await import('../e2e/cockpit-flow.spec');
 const {runInNewContext}=await import('node:vm');
 const sandbox={window:{tmBridge:{ping(){return null;}}},document:{querySelector(){return {content:'synthetic-csp'};}}};
 const inspect=(context:object)=>JSON.parse(JSON.stringify(runInNewContext(RENDERER_ISOLATION_EXPRESSION,context)));
 assert.deepEqual(inspect(sandbox),{requireAbsent:true,processAbsent:true,bridgeKeys:['ping'],csp:'synthetic-csp'});
 assert.deepEqual(inspect({...sandbox,require:()=>null,process:{}}),{requireAbsent:false,processAbsent:false,bridgeKeys:['ping'],csp:'synthetic-csp'});
});


test('synthetic file census rejects a substituted named object before hashing',async()=>{
 const {hashSyntheticCensusFile}=await import('../e2e/cockpit-flow.spec');
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {createHash}=await import('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-census-test-')),file=path.join(root,'probe.bin'),other=path.join(root,'other.bin');
 try{
  fs.writeFileSync(file,'synthetic initial');fs.writeFileSync(other,'synthetic substitute');const original=fs.lstatSync(file);
  assert.equal(hashSyntheticCensusFile(file,original),createHash('sha256').update('synthetic initial').digest('hex'));
  fs.renameSync(file,path.join(root,'parked.bin'));fs.renameSync(other,file);
  assert.throws(()=>hashSyntheticCensusFile(file,original),/identity changed/);
  fs.linkSync(file,path.join(root,'alias.bin'));assert.throws(()=>hashSyntheticCensusFile(file,fs.lstatSync(file)),/identity changed/);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});


test('actual outer IPC boundary refuses extra raw arguments and preserves a safe denial if diagnostics fail',async()=>{
 const {createIpcBoundary}=await import('../../apps/desktop/src/main/ipc/register');
 const {CHANNELS}=await import('../../packages/contracts/src/ipc/channel-map');
 const {randomUUID}=await import('node:crypto');
 const primary={id:11},url='tmapp://app/index.html';const frame:{url:string;top?:unknown}={url};frame.top=frame;
 const trusted={sender:primary,senderFrame:frame as import('../../apps/desktop/src/main/ipc/sender-guard').FrameLike};
 type Handler=(event:typeof trusted,...args:unknown[])=>Promise<import('../../packages/contracts/src').IpcResult<unknown>>;
 const handlers=new Map<string,Handler>();let calls=0,logThrows=false;
 const register=createIpcBoundary({handle:(channel,h)=>handlers.set(channel,h)},{primary,url,record:()=>{if(logThrows)throw new Error('Synthetic private diagnostic path');}});
 register(CHANNELS.projectAdd,async()=>{calls++;return {written:true};});
 const handler=handlers.get(CHANNELS.projectAdd)!;
 const request={requestId:randomUUID(),version:1,payload:{code:'SYN-RAW',customer:'Synthetic',siteAddress:'Site'}};
 const denied=await handler(trusted,request,'unexpected raw argument');assert.equal(denied.ok,false);if(!denied.ok)assert.equal(denied.error.code,'VALIDATION');assert.equal(calls,0);
 const ok=await handler(trusted,request);assert.equal(ok.ok,true);assert.equal(calls,1);
 const replay=await handler(trusted,request);assert.equal(replay.ok,false);if(!replay.ok)assert.equal(replay.error.code,'SECURITY');assert.equal(calls,1);
 logThrows=true;const noLog=await handler({...trusted,sender:{id:12}},request);assert.equal(noLog.ok,false);if(!noLog.ok)assert.equal(noLog.error.code,'SECURITY');assert.equal(calls,1);
 assert.throws(()=>register('unregistered.synthetic',async()=>null),/allowlist/);assert.equal(handlers.has('unregistered.synthetic'),false);
});

test('fixed raw proof program exercises the actual outer boundary against every channel and all planned frame cases locally',async()=>{
 const {rawProofPreload,rawProofPage,RAW_PROOF_URL,RAW_DENIED_URL,RAW_FRAME_URLS,RAW_TRUSTED_CASES,captureRawProofState}=await import('../e2e/cockpit-flow.spec');
 const {createIpcBoundary,registerFoundationHandlers}=await import('../../apps/desktop/src/main/ipc/register');
 const {ALL_CHANNELS}=await import('../../packages/contracts/src/ipc/channel-map');
 const {LocalStore}=await import('../../packages/persistence-sqlite/src/connection');
 const {randomUUID}=await import('node:crypto');const {runInNewContext}=await import('node:vm');
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-raw-plan-'));
 const db=new LocalStore(path.join(root,'local-data','db','app.sqlite'));
 try{
  db.initializeFictionalCompany();const projectId=db.createProject({code:'RAW-PROOF-CONTROL',customer:'Synthetic',siteAddress:'Site'});
  const baseline=captureRawProofState(db.db,root),primary={id:1};
  const top={url:RAW_PROOF_URL,top:undefined as import('../../apps/desktop/src/main/ipc/sender-guard').FrameLike|undefined};top.top=top;
  type Event=import('../../apps/desktop/src/main/ipc/sender-guard').SenderEventLike;
  const handlers=new Map<string,(event:Event,...args:unknown[])=>Promise<unknown>>();let unauthorizedDispatches=0;
  const register=createIpcBoundary({handle:(ch,h)=>handlers.set(ch,h)},{primary,url:RAW_PROOF_URL,record:()=>{}});
  registerFoundationHandlers({handle:register},{primary,url:RAW_PROOF_URL,getStore:()=>db});
  for(const channel of ALL_CHANNELS)if(!handlers.has(channel))register(channel,async()=>{unauthorizedDispatches++;throw new Error('Unexpected dispatch');});
  assert.deepEqual([...handlers.keys()].sort(),[...ALL_CHANNELS].sort());
  const script=rawProofPreload(projectId);
  assert.ok(!script.includes('contextBridge'));assert.ok(!script.includes('exposeInMainWorld'));
  assert.equal(rawProofPage('https://example.invalid/'),null);assert.equal(rawProofPage('tmapp://app/index.html'),null);
  const run=async(url:string,main:boolean,event:Event)=>{
   let action:(()=>Promise<void>)|undefined,receipt='';
   const invoke=(channel:string,...args:unknown[])=>{
    const h=handlers.get(channel);if(!h)return Promise.reject(new Error('No handler registered for synthetic channel'));
    // Transfer into the host realm as Electron structured clone does, preserving cycles.
    return h(event,...structuredClone(args));
   };
   runInNewContext(script,{require:(name:string)=>{assert.equal(name,'electron');return {ipcRenderer:{invoke}};},crypto:{randomUUID},location:{href:url},process:{isMainFrame:main},window:{addEventListener:(name:string,fn:()=>Promise<void>)=>{assert.equal(name,'DOMContentLoaded');assert.equal(action,undefined);action=fn;}},document:{documentElement:{setAttribute:(name:string,value:string)=>{assert.equal(name,'data-tm-raw-receipt');receipt=value;}}}});
   assert.ok(action);await action();return JSON.parse(receipt) as {url:string;main:boolean;results:Array<{name:string;code:string;correlated:boolean;health?:boolean}>};
  };
  const trusted=await run(RAW_PROOF_URL,true,{sender:primary,senderFrame:top});
  assert.deepEqual(trusted.results.map(x=>[x.name,x.code]),RAW_TRUSTED_CASES);assert.equal(trusted.results[0].health,true);
  for(const url of RAW_FRAME_URLS){const r=await run(url,false,{sender:primary,senderFrame:{url,top}});assert.deepEqual(r.results.map(x=>x.name),[...ALL_CHANNELS]);assert.ok(r.results.every(x=>x.code==='SECURITY'&&x.correlated));}
  const denied={url:RAW_DENIED_URL,top:undefined as import('../../apps/desktop/src/main/ipc/sender-guard').FrameLike|undefined};denied.top=denied;
  const r=await run(RAW_DENIED_URL,true,{sender:primary,senderFrame:denied});assert.ok(r.results.every(x=>x.code==='SECURITY'&&x.correlated));
  assert.equal(unauthorizedDispatches,0);assert.equal(captureRawProofState(db.db,root),baseline);
  db.createProject({code:'DETECT-CHANGE',customer:'Synthetic',siteAddress:'Site'});assert.notEqual(captureRawProofState(db.db,root),baseline);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
