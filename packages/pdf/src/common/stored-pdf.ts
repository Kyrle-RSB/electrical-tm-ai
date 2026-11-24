import path from 'node:path';import fs from 'node:fs';import crypto from 'node:crypto';
/** Immutable content-addressed storage for issued evidence (NOT the user Export/Save dialog). */
export async function storeImmutablePdf(artifactsRoot:string,pdf:Buffer):Promise<{sha256:string;relativePath:string}>{
 if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Not a PDF document');
 if(pdf.length>25*1024*1024)throw new Error('PDF exceeds storage limit');
 const sha256=crypto.createHash('sha256').update(pdf).digest('hex');
 const relativePath=path.join('issued',`${sha256}.pdf`),root=path.resolve(artifactsRoot),file=path.join(root,relativePath);
 for(const directory of [root,path.dirname(file)]){
  await fs.promises.mkdir(directory,{recursive:true,mode:0o700});
  const stat=await fs.promises.lstat(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe immutable PDF directory');
 }
 try{await fs.promises.writeFile(file,pdf,{flag:'wx',mode:0o600});}
 catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
   const stat=await fs.promises.lstat(file);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==pdf.length)throw new Error('Immutable PDF content hash collision or tampering');
   const handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
   try{
    const opened=await handle.stat();
    if(opened.dev!==stat.dev||opened.ino!==stat.ino||opened.size!==stat.size||opened.nlink!==1)throw new Error('Immutable PDF changed during inspection');
    const previous=Buffer.alloc(pdf.length);
    const {bytesRead}=await handle.read(previous,0,previous.length,0);
    const after=await handle.stat(),named=await fs.promises.lstat(file);
    if(bytesRead!==pdf.length||after.size!==pdf.length||after.nlink!==1||after.mtimeMs!==opened.mtimeMs||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==opened.dev||named.ino!==opened.ino||!previous.equals(pdf))throw new Error('Immutable PDF content hash collision or tampering');
   }finally{await handle.close();}
 }
 return {sha256,relativePath:relativePath.split(path.sep).join('/')};
}
