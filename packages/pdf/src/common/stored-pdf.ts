import path from 'node:path';import fs from 'node:fs';import crypto from 'node:crypto';
/** New PDF creation must be exclusive and must not leave a poisoned filename on a
 * detected partial write. Only remove the object this operation actually created. */
export async function writeNewPdfExclusive(file:string,pdf:Buffer,checkParent:()=>Promise<void>):Promise<void>{
 let identity:fs.Stats|undefined;
 try{
  await checkParent();
  const handle=await fs.promises.open(file,'wx+',0o600);
  try{
   identity=await handle.stat();
   if(!identity.isFile()||identity.nlink!==1)throw new Error('Unsafe new PDF object');
   await checkParent();
   const created=await fs.promises.lstat(file);
   if(!created.isFile()||created.isSymbolicLink()||created.nlink!==1||created.dev!==identity.dev||created.ino!==identity.ino)throw new Error('Unsafe new PDF identity');
   await handle.writeFile(pdf);await handle.sync();
   const written=await handle.stat();
   if(!written.isFile()||written.nlink!==1||written.size!==pdf.length)throw new Error('New PDF file changed during creation');
   const readback=Buffer.alloc(pdf.length);let offset=0;
   while(offset<readback.length){const {bytesRead}=await handle.read(readback,offset,readback.length-offset,offset);if(!bytesRead)throw new Error('New PDF content changed during creation');offset+=bytesRead;}
   if(!readback.equals(pdf))throw new Error('New PDF content changed during creation');
   await checkParent();
   const opened=await handle.stat(),named=await fs.promises.lstat(file);
   if(!opened.isFile()||opened.nlink!==1||opened.size!==pdf.length||opened.mtimeMs!==written.mtimeMs||opened.ctimeMs!==written.ctimeMs||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==identity.dev||named.ino!==identity.ino||named.size!==pdf.length||named.mtimeMs!==opened.mtimeMs||named.ctimeMs!==opened.ctimeMs)throw new Error('New PDF file changed during creation');
  }finally{await handle.close();}
 }catch(error){
  if(identity){
   try{
    await checkParent();const named=await fs.promises.lstat(file);
    if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==identity.dev||named.ino!==identity.ino)throw new Error('New PDF cleanup identity changed');
    await fs.promises.rm(file);
   }catch(cleanupError){if((cleanupError as NodeJS.ErrnoException).code!=='ENOENT')throw new AggregateError([error,cleanupError],'PDF creation failed; file retained for recovery');}
  }
  throw error;
 }
}
/** Immutable content-addressed storage for issued evidence (NOT the user Export/Save dialog). */
export async function storeImmutablePdf(artifactsRoot:string,pdf:Buffer):Promise<{sha256:string;relativePath:string}>{
 if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Not a PDF document');
 if(pdf.length>25*1024*1024)throw new Error('PDF exceeds storage limit');
 const sha256=crypto.createHash('sha256').update(pdf).digest('hex');
 const relativePath=path.join('issued',`${sha256}.pdf`),root=path.resolve(artifactsRoot),file=path.join(root,relativePath);
 const parents=new Map<string,fs.Stats>();
 for(const directory of [root,path.dirname(file)]){
  await fs.promises.mkdir(directory,{recursive:true,mode:0o700});
  const stat=await fs.promises.lstat(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe immutable PDF directory');
  parents.set(directory,stat);
 }
 const checkParent=async()=>{for(const [directory,identity] of parents){const named=await fs.promises.lstat(directory);if(!named.isDirectory()||named.isSymbolicLink()||named.dev!==identity.dev||named.ino!==identity.ino)throw new Error('Unsafe immutable PDF directory changed');}};
 try{await writeNewPdfExclusive(file,pdf,checkParent);}
 catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
   await checkParent();
   const stat=await fs.promises.lstat(file);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==pdf.length)throw new Error('Immutable PDF content hash collision or tampering');
   const handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
   try{
    const opened=await handle.stat();
    if(!opened.isFile()||opened.dev!==stat.dev||opened.ino!==stat.ino||opened.size!==stat.size||opened.nlink!==1||opened.mtimeMs!==stat.mtimeMs||opened.ctimeMs!==stat.ctimeMs)throw new Error('Immutable PDF changed during inspection');
    const previous=Buffer.alloc(pdf.length);
    let offset=0;
    while(offset<previous.length){const {bytesRead}=await handle.read(previous,offset,previous.length-offset,offset);if(!bytesRead)throw new Error('Immutable PDF changed during inspection');offset+=bytesRead;}
    await checkParent();
    const after=await handle.stat(),named=await fs.promises.lstat(file);
    if(!after.isFile()||after.size!==pdf.length||after.nlink!==1||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==opened.dev||named.ino!==opened.ino||named.size!==opened.size||named.mtimeMs!==opened.mtimeMs||named.ctimeMs!==opened.ctimeMs||!previous.equals(pdf))throw new Error('Immutable PDF content hash collision or tampering');
   }finally{await handle.close();}
 }
 return {sha256,relativePath:relativePath.split(path.sep).join('/')};
}
