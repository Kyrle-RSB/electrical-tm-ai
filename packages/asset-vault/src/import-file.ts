import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export type ImportedImage = {id:string;relativePath:string; sha256:string; mime:string; size:number};
const MAX = 12*1024*1024;
export function validateImageBytes(bytes:Buffer): 'image/png'|'image/jpeg' {
  if(bytes.length<16 || bytes.length>MAX)throw new Error('Image file too large or malformed');
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    if(bytes.subarray(12,16).toString('ascii')!=='IHDR'||bytes.length<33)throw new Error('Invalid PNG header');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    if(!width||!height||width>10000||height>10000)throw new Error('Unsupported image dimensions');
    if(!bytes.includes(Buffer.from([73,69,78,68])))throw new Error('Incomplete PNG');
    return 'image/png';
  }
  if(bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217) {
    return 'image/jpeg';
  }
  throw new Error('Unsupported or spoofed image content');
}
export async function importImageFromPickedFile(source:string, vaultRoot:string):Promise<ImportedImage> {
  // Native chooser paths are not trusted: refuse symlinks and avoid the lstat/readFile
  // time-of-check/time-of-use race by reading from the opened file descriptor.
  const before=await fs.promises.lstat(source);
  if(!before.isFile()||before.isSymbolicLink()||before.size>MAX)
    throw new Error('Image must be a regular permitted file');
  const noFollow=fs.constants.O_NOFOLLOW??0;
  const file=await fs.promises.open(source,fs.constants.O_RDONLY|noFollow);
  let bytes:Buffer;
  try{
    const opened=await file.stat();
    if(!opened.isFile()||opened.size>MAX||opened.size!==before.size||
       opened.dev!==before.dev||opened.ino!==before.ino)
      throw new Error('Image changed during secure import');
    bytes=await file.readFile();
    if(bytes.length!==opened.size)throw new Error('Image changed during secure import');
  }finally{await file.close();}
  const mime=validateImageBytes(bytes);
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const ext=mime==='image/png'?'png':'jpg';
  const id=crypto.randomUUID(), relativePath=path.join('images',`${id}.${ext}`);
  await fs.promises.mkdir(path.join(vaultRoot,'images'),{recursive:true,mode:0o700});
  await fs.promises.writeFile(path.join(vaultRoot,relativePath),bytes,{flag:'wx',mode:0o600});
  return {id,relativePath,sha256,mime,size:bytes.length};
}
