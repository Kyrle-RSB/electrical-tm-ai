import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
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
/** Synthetic proof export only. Issued invoices use immutable, content-addressed storage.
 * Replacement needs an affirmative OS-dialog + app confirmation in Electron main.
 */
export async function saveSyntheticInvoicePdf(
  target:string,params:Parameters<typeof makeSyntheticInvoicePdf>[0],
  opts:{allowReplace?:boolean;protectedRoots?:readonly string[]}={}
):Promise<string>{
  target=await resolveExportTarget(target,opts.protectedRoots??[]);
  await fs.promises.mkdir(path.dirname(target),{recursive:true});
  let exists=false;
  try{
    const stat=await fs.promises.lstat(target);
    if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Unsafe PDF destination type');
    exists=true;
  }catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  }
  if(exists&&!opts.allowReplace)throw Object.assign(new Error('PDF filename already exists. Choose another filename or confirm replacement.'),{code:'EEXIST'});
  const pdf=makeSyntheticInvoicePdf(params);
  // Exclusive new-file create remains the normal path. A confirmed replace is staged
  // into a same-folder temp file, so a failed write never truncates the old document.
  if(!exists){
    await fs.promises.writeFile(target,pdf,{flag:'wx',mode:0o600});
  }else{
    const temp=target+`.tmp-${randomUUID()}`;
    try{
      const handle=await fs.promises.open(temp,'wx',0o600);
      try{await handle.writeFile(pdf);await handle.sync();}finally{await handle.close();}
      await fs.promises.rename(temp,target);
    }finally{await fs.promises.rm(temp,{force:true});}
  }
  return target;
}
