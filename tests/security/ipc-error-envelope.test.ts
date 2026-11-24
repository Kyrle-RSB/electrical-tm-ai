import test from 'node:test';import {strict as assert} from 'node:assert';
import {classifyIpcError} from '../../packages/contracts/src/ipc/error-envelope';
test('IPC error envelope classifies errors without leaking full local file paths',()=>{
 assert.equal(classifyIpcError(new Error('EEXIST: file already exists /Users/private/Invoices/2026.pdf')).code,'CONFLICT');
 assert.equal(classifyIpcError(new Error('SECURITY: sender rejected')).code,'SECURITY');
 assert.equal(classifyIpcError(new Error('Unrecognized database exception: /Users/private/data.sqlite')).code,'INTERNAL');
 for(const e of [new Error('EEXIST: /Users/private/secret'),new Error('SECURITY: /Users/private')]){
  const result=classifyIpcError(e);assert.equal(JSON.stringify(result).includes('/Users/private'),false);
 }
});

test('known malformed input failures have stable VALIDATION codes, not INTERNAL',async()=>{
 const {validateProjectInput,validateBusinessInput,assertNoPayload}=await import('../../packages/contracts/src/ipc/request-envelope');
 const failures=[()=>validateProjectInput({code:'../outside',customer:'Fictional',siteAddress:'Site'}),()=>validateBusinessInput({legalName:'',tradeName:'',phone:'',email:'',mailingAddress:'',taxId:'',contractorLicense:''}),()=>assertNoPayload({unexpected:true})];
 for(const fail of failures){let error:unknown;try{fail();}catch(e){error=e;}assert.ok(error instanceof Error);assert.equal(classifyIpcError(error).code,'VALIDATION',error.message);}
 assert.equal(classifyIpcError(new Error('Proof accepts only the fixed fake token')).code,'VALIDATION');
 assert.equal(classifyIpcError(new Error('Unsafe application data file')).code,'INTERNAL');
});
