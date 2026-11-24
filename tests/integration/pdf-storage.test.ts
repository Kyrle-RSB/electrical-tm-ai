import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {makeSyntheticInvoicePdf,saveSyntheticInvoicePdf} from '../../packages/pdf/src/invoices/render-invoice';
import {storeImmutablePdf} from '../../packages/pdf/src/common/stored-pdf';
const fixture={company:'Demo Electric',customer:'Fake',project:'X',invoiceNumber:'TEST-001',taxId:'FAKE',contractorLicense:'FAKE',amount:'25.00'};
test('issued PDF bytes stored immutably and repeated same-content export does not duplicate',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-immutable-pdf-'));
 try{const bytes=makeSyntheticInvoicePdf(fixture);
  const first=await storeImmutablePdf(folder,bytes),second=await storeImmutablePdf(folder,bytes);
  assert.deepEqual(first,second);assert.equal(fs.readFileSync(path.join(folder,first.relativePath)).compare(bytes),0);
  await assert.rejects(storeImmutablePdf(folder,Buffer.from('invalid')),/Not a PDF/);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('existing PDF never overwrites without confirmation; confirmed replace works',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-replace-'));
 const file=path.join(dir,'synthetic.pdf');try{
  await saveSyntheticInvoicePdf(file,fixture);const original=fs.readFileSync(file);
  await assert.rejects(saveSyntheticInvoicePdf(file,{...fixture,amount:'30.00'}),/already exists/);
  assert.deepEqual(fs.readFileSync(file),original);
  await saveSyntheticInvoicePdf(file,{...fixture,amount:'30.00'},{allowReplace:true});
  assert.notDeepEqual(fs.readFileSync(file),original);
  assert.ok(fs.readFileSync(file).includes(Buffer.from('30.00')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
