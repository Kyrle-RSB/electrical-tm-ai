import path from 'node:path';
import fs from 'node:fs';
/** Resolve only internally generated photo locators, never user-supplied arbitrary paths. */
const IMAGE=/^images\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$/i;
export function resolveManagedImage(vaultRoot:string,locator:string):string{
 if(!IMAGE.test(locator))throw new Error('Invalid managed image locator');
 const root=path.resolve(vaultRoot),target=path.resolve(root,locator);
 if(!target.startsWith(root+path.sep))throw new Error('Managed image path escapes vault');
 return target;
}

/** Bind the owned directories for the entire operation, including the final check. */
export async function assertManagedImageDirectory(root:string,create=false):Promise<()=>Promise<void>>{
 const parents=new Map<string,fs.Stats>();
 for(const directory of [path.resolve(root),path.resolve(root,'images')]){
  if(create)await fs.promises.mkdir(directory,{recursive:true,mode:0o700});
  const stat=await fs.promises.lstat(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe managed image directory');
  parents.set(directory,stat);
 }
 return async()=>{for(const [directory,identity] of parents){const named=await fs.promises.lstat(directory);if(!named.isDirectory()||named.isSymbolicLink()||named.dev!==identity.dev||named.ino!==identity.ino)throw new Error('Unsafe managed image directory changed');}};
}
/** Exclusive import with descriptor readback and identity-bound failure cleanup. */
export async function writeManagedImage(file:string,bytes:Buffer,checkParent:()=>Promise<void>):Promise<void>{
 let identity:fs.Stats|undefined;
 try{
  await checkParent();
  const handle=await fs.promises.open(file,'wx+',0o600);
  try{
   identity=await handle.stat();
   if(!identity.isFile()||identity.nlink!==1)throw new Error('Unsafe new managed image');
   await handle.writeFile(bytes);await handle.sync();
   const written=await handle.stat();
   if(!written.isFile()||written.nlink!==1||written.size!==bytes.length)throw new Error('Managed image changed during import');
   const readback=Buffer.alloc(bytes.length);let offset=0;
   while(offset<readback.length){const {bytesRead}=await handle.read(readback,offset,readback.length-offset,offset);if(!bytesRead)throw new Error('Managed image changed during import');offset+=bytesRead;}
   await checkParent();
   const after=await handle.stat(),named=await fs.promises.lstat(file);
   if(!readback.equals(bytes)||!after.isFile()||after.nlink!==1||after.size!==bytes.length||after.mtimeMs!==written.mtimeMs||after.ctimeMs!==written.ctimeMs||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==identity.dev||named.ino!==identity.ino||named.size!==after.size||named.mtimeMs!==after.mtimeMs||named.ctimeMs!==after.ctimeMs)throw new Error('Managed image changed during import');
  }finally{await handle.close();}
 }catch(error){
  if(identity){
   try{
    await checkParent();const named=await fs.promises.lstat(file);
    if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==identity.dev||named.ino!==identity.ino)throw new Error('Unsafe managed image cleanup identity');
    await fs.promises.rm(file);
   }catch(cleanup){if((cleanup as NodeJS.ErrnoException).code!=='ENOENT')throw new AggregateError([error,cleanup],'Image import failed; unverified file retained for recovery');}
  }
  throw error;
 }
}
export const MAX_IMAGE_BYTES=12*1024*1024;
/** Bound the descriptor read; a concurrent append cannot trigger unbounded allocation. */
export async function readRegularImage(file:string):Promise<Buffer>{
 const before=await fs.promises.lstat(file);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>MAX_IMAGE_BYTES)
  throw new Error('Image must be a regular permitted file');
 const handle=await fs.promises.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{
  const opened=await handle.stat();
  if(!opened.isFile()||opened.nlink!==1||opened.size>MAX_IMAGE_BYTES||opened.size!==before.size||opened.dev!==before.dev||opened.ino!==before.ino||opened.mtimeMs!==before.mtimeMs||opened.ctimeMs!==before.ctimeMs)
   throw new Error('Image changed during secure import');
  const bytes=Buffer.alloc(opened.size);
  let offset=0;
  while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(bytesRead===0)throw new Error('Image changed during secure import');offset+=bytesRead;}
  const after=await handle.stat();
  const named=await fs.promises.lstat(file);
  if(!after.isFile()||after.nlink!==1||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs||!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.dev!==opened.dev||named.ino!==opened.ino||named.size!==opened.size||named.mtimeMs!==opened.mtimeMs||named.ctimeMs!==opened.ctimeMs)throw new Error('Image changed during secure import');
  return bytes;
 }finally{await handle.close();}
}
