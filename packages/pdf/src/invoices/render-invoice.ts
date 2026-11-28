import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {writeNewPdfExclusive} from '../common/stored-pdf';
/** Minimal self-contained PDF-1.4 synthetic feasibility renderer; NOT production invoice engine. */
function asciiSafe(s:string):string {return s.normalize('NFKD').replace(/[^\x20-\x7e]/g,'?').replace(/[()\\]/g,'\\$&').slice(0,110);}
export function makeSyntheticInvoicePdf(info:{company:string;customer:string;project:string;invoiceNumber:string;taxId:string;contractorLicense:string;amount:string}):Buffer {
  const lines=[
    ['SYNTHETIC INVOICE - PHASE 1 ENGINEERING PROOF',18],
    [`Business: ${info.company}`,12],
    [`Customer: ${info.customer}`,12],
    [`Project: ${info.project}`,12],
    [`Invoice: ${info.invoiceNumber}`,12],
    [`Amount: ${info.amount} CAD`,12],
    ['NOT VALID FOR ACTUAL BILLING',11],
    [`Tax ID: ${info.taxId}`,10],
    [`Electrical Contractor License ID: ${info.contractorLicense}`,10]
  ] as const;
  let y=755;
  const content=lines.map(([txt,size])=>{const row=`BT /F1 ${size} Tf 48 ${y} Td (${asciiSafe(txt)}) Tj ET\n`; y-=size+24;return row;}).join('');
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content,'ascii')} >>\nstream\n${content}endstream`
  ];
  let pdf='%PDF-1.4\n%ENGINEERING PROOF ONLY\n';const offsets=[0];
  objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(pdf,'ascii')); pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
  const off=Buffer.byteLength(pdf,'ascii');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(n=>{pdf+=`${String(n).padStart(10,'0')} 00000 n \n`;});
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}
/** Resolve the physical parent before allowing an export. Managed data is never a Save/Replace target. */
async function resolveExportTarget(target:string,protectedRoots:readonly string[]):Promise<string>{
  const absolute=path.resolve(target);
  let parent=path.dirname(absolute);
  const tail=[path.basename(absolute)];
  // Resolve the nearest existing ancestor; missing directories must not hide a protected path.
  for(;;){
    try{parent=await fs.promises.realpath(parent);break;}
    catch(error){
      if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
      const next=path.dirname(parent);
      if(next===parent)throw error;
      tail.unshift(path.basename(parent));parent=next;
    }
  }
  const resolved=path.join(parent,...tail);
  const comparable=(p:string)=>process.platform==='win32'||process.platform==='darwin'?p.toLowerCase():p;
  for(const root of protectedRoots){
    const actual=await fs.promises.realpath(root);
    for(const candidate of [absolute,resolved]){
      const relative=path.relative(comparable(actual),comparable(candidate));
      if(relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)))
        throw new Error('SECURITY: PDF export cannot target managed application data');
    }
  }
  return resolved;
}
export type PdfExportIdentity={dev:number;ino:number;size:number;mtimeMs:number;ctimeMs:number;sha256:string};
async function inspectExportIdentity(target:string,checkParent:()=>Promise<void>):Promise<PdfExportIdentity|null>{
 await checkParent();
 // Open first (no-follow, non-blocking), then judge the descriptor and confirm the
 // name still points at it. Checking the path before opening it would be a race.
 let handle:fs.promises.FileHandle;
 try{handle=await fs.promises.open(target,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));}
 catch(error){
  const code=(error as NodeJS.ErrnoException).code;
  if(code==='ENOENT'){
   // Absent is only acceptable when nothing, not even a dangling link, holds the name.
   try{await fs.promises.lstat(target);}catch(missing){if((missing as NodeJS.ErrnoException).code==='ENOENT'){await checkParent();return null;}throw missing;}
   throw new Error('Unsafe PDF destination type');
  }
  if(['ELOOP','EISDIR','EMLINK'].includes(code??''))throw new Error('Unsafe PDF destination type');
  throw error;
 }
 try{
  const stat=await handle.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>25*1024*1024)throw new Error('Unsafe PDF destination type');
  const before=await fs.promises.lstat(target);
  await checkParent();
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1)throw new Error('Unsafe PDF destination type');
  if(stat.dev!==before.dev||stat.ino!==before.ino||stat.size!==before.size||stat.mtimeMs!==before.mtimeMs||stat.ctimeMs!==before.ctimeMs)throw new Error('PDF destination changed during inspection');
  await checkParent();
  const bytes=Buffer.alloc(stat.size);let offset=0;
  while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)throw new Error('PDF destination changed during inspection');offset+=bytesRead;}
  await checkParent();
  const after=await handle.stat(),named=await fs.promises.lstat(target);if(!after.isFile()||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs||after.nlink!==1||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==stat.dev||named.ino!==stat.ino||named.size!==stat.size||named.mtimeMs!==stat.mtimeMs||named.ctimeMs!==stat.ctimeMs)throw new Error('PDF destination changed during inspection');
  await checkParent();
  return {dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs,sha256:createHash('sha256').update(bytes).digest('hex')};
 }finally{await handle.close();}
}
/** Capture the selected external export before asking for replacement confirmation. */
export type PdfExportSelection={target:string;parent:{dev:number;ino:number};existing:PdfExportIdentity|null};
export async function capturePdfExportTarget(target:string,protectedRoots:readonly string[]):Promise<PdfExportSelection>{
 const resolved=await resolveExportTarget(target,protectedRoots),parent=path.dirname(resolved);
 const initial=await fs.promises.lstat(parent);
 if(!initial.isDirectory()||initial.isSymbolicLink())throw new Error('PDF destination directory changed');
 const checkParent=async()=>{
  const named=await fs.promises.lstat(parent);
  if(!named.isDirectory()||named.isSymbolicLink()||named.dev!==initial.dev||named.ino!==initial.ino||await resolveExportTarget(target,protectedRoots)!==resolved)throw new Error('PDF destination directory changed');
 };
 const existing=await inspectExportIdentity(resolved,checkParent);
 await checkParent();
 return {target:resolved,parent:{dev:initial.dev,ino:initial.ino},existing};
}
function sameIdentity(a:PdfExportIdentity|null,b:PdfExportIdentity|null){
 return JSON.stringify(a)===JSON.stringify(b);
}
/** Synthetic proof export only. Issued invoices use immutable, content-addressed storage.
 * Replacement needs an affirmative OS-dialog + app confirmation in Electron main.
 */
export async function saveSyntheticInvoicePdf(
  target:string,params:Parameters<typeof makeSyntheticInvoicePdf>[0],
  opts:{allowReplace?:boolean;protectedRoots?:readonly string[];expectedSelection?:PdfExportSelection}={}
):Promise<string>{
  const protectedRoots=opts.protectedRoots??[];
  target=await resolveExportTarget(target,protectedRoots);
  const parent=path.dirname(target);
  if(opts.expectedSelection===undefined)await fs.promises.mkdir(parent,{recursive:true});
  const parentIdentity=await fs.promises.lstat(parent);
  if(!parentIdentity.isDirectory()||parentIdentity.isSymbolicLink())throw new Error('PDF destination directory changed');
  if(opts.expectedSelection&&(opts.expectedSelection.target!==target||opts.expectedSelection.parent.dev!==parentIdentity.dev||opts.expectedSelection.parent.ino!==parentIdentity.ino))throw new Error('PDF destination directory changed after selection');
  // Re-resolve the protected-root policy and verify the directory immediately before each write/activation.
  const checkParent=async()=>{
    if(await resolveExportTarget(target,protectedRoots)!==target)throw new Error('PDF destination directory changed');
    const named=await fs.promises.lstat(parent);
    if(!named.isDirectory()||named.isSymbolicLink()||named.dev!==parentIdentity.dev||named.ino!==parentIdentity.ino)throw new Error('PDF destination directory changed');
  };
  await checkParent();
  const identity=await inspectExportIdentity(target,checkParent),exists=identity!==null;
  if(opts.expectedSelection&&!sameIdentity(opts.expectedSelection.existing,identity))throw new Error('PDF destination changed after selection');
  if(exists&&!opts.allowReplace)throw Object.assign(new Error('PDF filename already exists. Choose another filename or confirm replacement.'),{code:'EEXIST'});
  const pdf=makeSyntheticInvoicePdf(params);
  // Exclusive new-file create remains the normal path. A confirmed replace is staged
  // into a same-folder temp file, so a failed write never truncates the old document.
  if(!exists){
    await writeNewPdfExclusive(target,pdf,checkParent);
  }else{
    const temp=target+`.tmp-${randomUUID()}`;
    let stagedIdentity:fs.Stats|undefined;
    try{
      await checkParent();
      const handle=await fs.promises.open(temp,'wx',0o600);
      try{
        stagedIdentity=await handle.stat();
        if(!stagedIdentity.isFile()||stagedIdentity.nlink!==1)throw new Error('Unsafe PDF staged file');
        await checkParent();
        const created=await fs.promises.lstat(temp);
        if(!created.isFile()||created.isSymbolicLink()||created.nlink!==1||created.dev!==stagedIdentity.dev||created.ino!==stagedIdentity.ino)throw new Error('PDF staged file changed');
        await handle.writeFile(pdf);await handle.sync();
      }finally{await handle.close();}
      if(!sameIdentity(identity,await inspectExportIdentity(target,checkParent)))throw new Error('PDF destination changed before replacement');
      await checkParent();
      const staged=await inspectExportIdentity(temp,checkParent);
      if(!staged||staged.dev!==stagedIdentity?.dev||staged.ino!==stagedIdentity?.ino||staged.size!==pdf.length||staged.sha256!==createHash('sha256').update(pdf).digest('hex'))throw new Error('PDF staged file changed');
      if(!sameIdentity(identity,await inspectExportIdentity(target,checkParent)))throw new Error('PDF destination changed before replacement');
      await checkParent();
      if(!sameIdentity(staged,await inspectExportIdentity(temp,checkParent)))throw new Error('PDF staged file changed');
      await checkParent();
      // Final observed metadata comparisons without yielding between pathname checks
      // and submitting rename. These are not a portable atomic compare-and-swap.
      const unchanged=(file:string,expected:PdfExportIdentity)=>{const named=fs.lstatSync(file);return named.isFile()&&!named.isSymbolicLink()&&named.nlink===1&&named.dev===expected.dev&&named.ino===expected.ino&&named.size===expected.size&&named.mtimeMs===expected.mtimeMs&&named.ctimeMs===expected.ctimeMs;};
      if(!unchanged(temp,staged))throw new Error('PDF staged file changed');
      if(!identity||!unchanged(target,identity))throw new Error('PDF destination changed before replacement');
      await fs.promises.rename(temp,target);
    }catch(error){
      // Preserve the primary error and never clean through a redirected parent or substituted file.
      if(stagedIdentity){
        try{
          await checkParent();
          const staged=await fs.promises.lstat(temp);
          if(staged.isFile()&&!staged.isSymbolicLink()&&staged.nlink===1&&staged.dev===stagedIdentity.dev&&staged.ino===stagedIdentity.ino)await fs.promises.rm(temp);
        }catch(cleanupError){
          if((cleanupError as NodeJS.ErrnoException).code!=='ENOENT')throw new AggregateError([error,cleanupError],'PDF export failed; staged file retained for recovery');
        }
      }
      throw error;
    }
  }
  return target;
}
