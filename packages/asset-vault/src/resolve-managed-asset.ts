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

/** The application owns these two directory levels; do not follow a redirected root or child. */
export async function assertManagedImageDirectory(root:string,create=false):Promise<void>{
 for(const directory of [path.resolve(root),path.resolve(root,'images')]){
  if(create)await fs.promises.mkdir(directory,{recursive:true,mode:0o700});
  const stat=await fs.promises.lstat(directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe managed image directory');
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
