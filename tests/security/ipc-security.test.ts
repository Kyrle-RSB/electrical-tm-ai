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
 await bridge.importReceiptImage();await bridge.saveSyntheticPdf();await bridge.chooseBackupFolderAndBackUp();await bridge.getBackupFolder();await bridge.chooseBackupFolder();await bridge.backUpToSelectedFolder();await bridge.chooseBackupAndRestore();await bridge.storeFakeSecretProof();await bridge.checkFakeSecretProof();await bridge.removeFakeSecretProof();
 assert.deepEqual(seen,[...ALL_CHANNELS]);
});

test('native foreign-window fixture covers the exact fixed bridge method set',async()=>{
 const {PACKAGED_SECURITY_METHODS}=await import('../e2e/cockpit-flow.spec');
 const {createBridge}=await import('../../apps/desktop/src/preload/bridge');
 const bridge=createBridge(async()=>{throw new Error('No transport in method census');});
 assert.deepEqual([...PACKAGED_SECURITY_METHODS],Object.keys(bridge));
 assert.equal(new Set(PACKAGED_SECURITY_METHODS).size,PACKAGED_SECURITY_METHODS.length);
});
