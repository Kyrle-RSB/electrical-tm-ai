import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {validateBusinessInput,validateProjectDetailsInput,validateProjectStatusInput} from '../../packages/contracts/src/ipc/request-envelope';
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
