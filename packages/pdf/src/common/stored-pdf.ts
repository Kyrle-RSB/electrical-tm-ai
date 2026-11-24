import path from 'node:path';import fs from 'node:fs';import crypto from 'node:crypto';
/** Immutable content-addressed storage for issued evidence (NOT the user Export/Save dialog). */
export async function storeImmutablePdf(artifactsRoot:string,pdf:Buffer):Promise<{sha256:string;relativePath:string}>{
 if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Not a PDF document');
 if(pdf.length>25*1024*1024)throw new Error('PDF exceeds storage limit');
 const sha256=crypto.createHash('sha256').update(pdf).digest('hex');
 const relativePath=path.join('issued',`${sha256}.pdf`),root=path.resolve(artifactsRoot),file=path.join(root,relativePath);
 await fs.promises.mkdir(path.dirname(file),{recursive:true,mode:0o700});
 try{await fs.promises.writeFile(file,pdf,{flag:'wx',mode:0o600});}
 catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
   const previous=await fs.promises.readFile(file);
   if(!previous.equals(pdf))throw new Error('Immutable PDF content hash collision or tampering');
 }
 return {sha256,relativePath:relativePath.split(path.sep).join('/')};
}
