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
