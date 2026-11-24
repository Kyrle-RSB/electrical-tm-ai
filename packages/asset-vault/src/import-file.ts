import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export type ImportedImage = {id:string;relativePath:string; sha256:string; mime:'image/png'|'image/jpeg'; size:number};
import {assertManagedImageDirectory,readRegularImage,MAX_IMAGE_BYTES} from './resolve-managed-asset';
const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE=Uint32Array.from({length:256},(_,index)=>{
 let value=index;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;
});
function pngChecksum(bytes:Buffer):number{
 let crc=0xffffffff;for(const byte of bytes)crc=(crc>>>8)^CRC_TABLE[(crc^byte)&255];return (crc^0xffffffff)>>>0;
}
function validDimensions(width:number,height:number){
 if(!width||!height||width>10000||height>10000)throw new Error('Unsupported image dimensions');
}
function validatePng(bytes:Buffer){
 let offset=8,header=false,data=false,closedData=false;
 while(offset+12<=bytes.length){
  const size=bytes.readUInt32BE(offset),end=offset+12+size;
  if(end>bytes.length)throw new Error('Incomplete PNG chunk');
  const kind=bytes.toString('ascii',offset+4,offset+8);
  if(!/^[A-Za-z]{4}$/.test(kind)||pngChecksum(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw new Error('Invalid PNG chunk checksum or type');
  if(!header){
   if(kind!=='IHDR'||size!==13)throw new Error('Invalid PNG header');
   validDimensions(bytes.readUInt32BE(offset+8),bytes.readUInt32BE(offset+12));
   const depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
   if(!depths[bytes[offset+17]]?.includes(bytes[offset+16])||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)throw new Error('Invalid PNG header');
   header=true;
  }else if(kind==='IHDR')throw new Error('Duplicate PNG header');
  if(kind==='IDAT'){
   if(closedData)throw new Error('Noncontiguous PNG data');
   data=true;
  }else if(data)closedData=true;
  if(kind==='IEND'){
   if(size!==0||!data||end!==bytes.length)throw new Error('Invalid PNG end');
   return;
  }
  offset=end;
 }
 throw new Error('Incomplete PNG');
}
/** Check JPEG marker, frame, scan and segment bounds; this is not a pixel decoder. */
function validateJpeg(bytes:Buffer){
 let offset=2,inScan=false,frame=false,scan=false;
 while(offset<bytes.length){
  if(inScan){
   while(offset<bytes.length&&bytes[offset]!==255)offset++;
   if(offset>=bytes.length)break;
  }else if(bytes[offset]!==255)throw new Error('Malformed JPEG marker');
  while(offset<bytes.length&&bytes[offset]===255)offset++;
  if(offset>=bytes.length)break;
  const marker=bytes[offset++];
  if(inScan&&(marker===0||(marker>=0xd0&&marker<=0xd7)))continue;
  inScan=false;
  if(marker===0xd9){if(!frame||!scan||offset!==bytes.length)throw new Error('Invalid JPEG end');return;}
  if(marker===0||marker===0xd8||(marker>=0xd0&&marker<=0xd7))throw new Error('Invalid JPEG marker');
  if(marker===1)continue;
  if(offset+2>bytes.length)break;
  const size=bytes.readUInt16BE(offset),end=offset+size;
  if(size<2||end>bytes.length)throw new Error('Invalid JPEG segment length');
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(size<11||size!==8+3*bytes[offset+7])throw new Error('Invalid JPEG frame');
   validDimensions(bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3));frame=true;
  }
  if(marker===0xda){
   if(!frame||size<8||size!==6+2*bytes[offset+2])throw new Error('Invalid JPEG scan');
   scan=true;inScan=true;
  }
  offset=end;
 }
 throw new Error('Incomplete JPEG');
}
export function validateImageBytes(bytes:Buffer): 'image/png'|'image/jpeg' {
 if(bytes.length<16||bytes.length>MAX_IMAGE_BYTES)throw new Error('Image file too large or malformed');
 if(bytes.subarray(0,8).equals(PNG_SIGNATURE)){validatePng(bytes);return 'image/png';}
 if(bytes[0]===255&&bytes[1]===216){validateJpeg(bytes);return 'image/jpeg';}
 throw new Error('Unsupported or spoofed image content');
}
export async function importImageFromPickedFile(source:string, vaultRoot:string):Promise<ImportedImage> {
 const bytes=await readRegularImage(source);
  const mime=validateImageBytes(bytes);
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const ext=mime==='image/png'?'png':'jpg';
  // Portable vault locators are always POSIX paths, even on Windows.
  const id=crypto.randomUUID(), relativePath=`images/${id}.${ext}`;
  await assertManagedImageDirectory(vaultRoot,true);
  await fs.promises.writeFile(path.join(vaultRoot,relativePath),bytes,{flag:'wx',mode:0o600});
  return {id,relativePath,sha256,mime,size:bytes.length};
}
