import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {makeSyntheticInvoicePdf,saveSyntheticInvoicePdf,capturePdfExportTarget} from '../../packages/pdf/src/invoices/render-invoice';
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

test('confirmed synthetic export cannot overwrite an issued original in managed storage',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-issued-export-'));
 try{
  const managed=path.join(dir,'private'),artifacts=path.join(managed,'artifacts');
  const original=makeSyntheticInvoicePdf(fixture);
  const issued=await storeImmutablePdf(artifacts,original);
  const target=path.join(artifacts,issued.relativePath);
  const options={allowReplace:true,protectedRoots:[managed]};
  await assert.rejects(saveSyntheticInvoicePdf(target,{...fixture,amount:'99.00'},options),/managed application data/);
  assert.deepEqual(fs.readFileSync(target),original);
  await assert.rejects(saveSyntheticInvoicePdf(path.join(managed,'new.pdf'),fixture,options),/managed application data/);
  assert.equal(fs.existsSync(path.join(managed,'new.pdf')),false);
  const alias=path.join(dir,'alias');
  fs.symlinkSync(managed,alias,process.platform==='win32'?'junction':'dir');
  await assert.rejects(saveSyntheticInvoicePdf(path.join(alias,'artifacts',issued.relativePath),fixture,options),/managed application data/);
  const outside=path.join(dir,'export.pdf');
  await saveSyntheticInvoicePdf(outside,fixture,options);
  assert.deepEqual(fs.readFileSync(outside),original);
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('immutable PDF storage refuses redirected issued directory without external writes',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-boundary-'));
 try{
  const outside=path.join(home,'outside');fs.mkdirSync(outside);
  const artifacts=path.join(home,'artifacts');fs.mkdirSync(artifacts);
  fs.symlinkSync(outside,path.join(artifacts,'issued'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(storeImmutablePdf(artifacts,makeSyntheticInvoicePdf(fixture)),/Unsafe immutable PDF directory/);
  assert.deepEqual(fs.readdirSync(outside),[]);
 }finally{fs.rmSync(home,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('failed staged replacement never truncates existing export',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-failure-')),file=path.join(root,'existing.pdf');
 const originalOpen=fs.promises.open;
 try{
  await saveSyntheticInvoicePdf(file,fixture);const before=fs.readFileSync(file);
  fs.promises.open=(async(...args:Parameters<typeof originalOpen>)=>{
   if(String(args[0]).includes('.tmp-'))throw Object.assign(new Error('Synthetic disk full'),{code:'ENOSPC'});
   return originalOpen(...args);
  }) as typeof originalOpen;
  await assert.rejects(saveSyntheticInvoicePdf(file,{...fixture,amount:'99.00'},{allowReplace:true}),/disk full/);
  assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readdirSync(root),['existing.pdf']);
 }finally{fs.promises.open=originalOpen;fs.rmSync(root,{recursive:true,force:true});}
});


test('confirmed export replacement is bound to the selected file identity',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-changed-')),file=path.join(root,'existing.pdf');
 try{
  await saveSyntheticInvoicePdf(file,fixture);
  const expectedExisting=await capturePdfExportTarget(file,[]);
  fs.writeFileSync(file,makeSyntheticInvoicePdf({...fixture,amount:'33.00'}));
  const changed=fs.readFileSync(file);
  await assert.rejects(saveSyntheticInvoicePdf(file,{...fixture,amount:'99.00'},{allowReplace:true,expectedExisting}),/changed after selection/);
  assert.deepEqual(fs.readFileSync(file),changed);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('immutable PDF verification completes bounded short reads without changing stored bytes',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-short-read-'));
 const nativeOpen=fs.promises.open;
 try{
  const bytes=makeSyntheticInvoicePdf(fixture),issued=await storeImmutablePdf(root,bytes);
  const stored=path.join(root,issued.relativePath);let reads=0;
  fs.promises.open=(async(...args:Parameters<typeof nativeOpen>)=>{
   const handle=await nativeOpen(...args);
   if(String(args[0])===stored){
    const read=handle.read.bind(handle);
    handle.read=(async(buffer:Buffer,offset:number,length:number,position:number)=>{reads++;return read(buffer,offset,Math.min(length,17),position);}) as typeof handle.read;
   }
   return handle;
  }) as typeof nativeOpen;
  assert.deepEqual(await storeImmutablePdf(root,bytes),issued);
  assert.ok(reads>1);assert.deepEqual(fs.readFileSync(stored),bytes);
 }finally{fs.promises.open=nativeOpen;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('new export rejects a selected parent redirected into managed storage during inspection',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-parent-swap-')));
 const originalLstat=fs.promises.lstat;
 try{
  const managed=path.join(root,'managed'),outside=path.join(root,'outside'),parked=path.join(root,'parked');
  fs.mkdirSync(managed);fs.mkdirSync(outside);const target=path.join(outside,'new.pdf');let swapped=false;
  fs.promises.lstat=(async(...args:Parameters<typeof originalLstat>)=>{
   if(String(args[0])===target&&!swapped){swapped=true;fs.renameSync(outside,parked);fs.symlinkSync(managed,outside,process.platform==='win32'?'junction':'dir');}
   return originalLstat(...args);
  }) as typeof originalLstat;
  await assert.rejects(saveSyntheticInvoicePdf(target,fixture,{protectedRoots:[managed]}),/managed application data|directory changed/);
  assert.equal(swapped,true);assert.deepEqual(fs.readdirSync(managed),[]);assert.deepEqual(fs.readdirSync(parked),[]);
 }finally{fs.promises.lstat=originalLstat;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('confirmed replace refuses same-size staged byte tampering and preserves the previous export',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'forkb-pdf-stage-tamper-'))),target=path.join(root,'existing.pdf');
 const nativeOpen=fs.promises.open;
 try{
  await saveSyntheticInvoicePdf(target,fixture);const original=fs.readFileSync(target);let tampered=false;
  fs.promises.open=(async(...args:Parameters<typeof nativeOpen>)=>{
   if(String(args[0])===target&&!tampered){
    const staged=fs.readdirSync(root).find(name=>name.startsWith('existing.pdf.tmp-'));
    if(staged){const file=path.join(root,staged),bytes=fs.readFileSync(file);bytes[10]^=1;fs.writeFileSync(file,bytes);tampered=true;}
   }
   return nativeOpen(...args);
  }) as typeof nativeOpen;
  await assert.rejects(saveSyntheticInvoicePdf(target,{...fixture,amount:'99.00'},{allowReplace:true}),/staged file changed/);
  assert.equal(tampered,true);assert.deepEqual(fs.readFileSync(target),original);assert.deepEqual(fs.readdirSync(root),['existing.pdf']);
 }finally{fs.promises.open=nativeOpen;fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
