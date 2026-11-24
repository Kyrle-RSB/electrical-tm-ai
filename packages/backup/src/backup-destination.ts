import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/** Canonicalize even a not-yet-created destination using its nearest existing ancestor. */
export async function canonicalBackupPath(value:string):Promise<string>{
 let current=path.resolve(value);const tail:string[]=[];
 for(;;){
  try{return path.join(await fs.promises.realpath(current),...tail);}
  catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
   const parent=path.dirname(current);if(parent===current)throw error;
   tail.unshift(path.basename(current));current=parent;
  }
 }
}
export function backupPathsOverlap(a:string,b:string):boolean{
 const key=(p:string)=>process.platform==='win32'||process.platform==='darwin'?p.toLowerCase():p;
 const contains=(parent:string,child:string)=>{
  const relative=path.relative(key(parent),key(child));
  return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));
 };
 return contains(a,b)||contains(b,a);
}
/** Non-secret, local-machine-only preference. It is deliberately not in a portable backup. */
export class BackupDestinationPreference {
 constructor(private readonly preferenceFile:string,private readonly dataRoot:string){}
 async get():Promise<string|null>{
  let raw:string;
  try{raw=await fs.promises.readFile(this.preferenceFile,'utf8');}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
  const x=JSON.parse(raw) as {version?:unknown;folder?:unknown};
  if(x.version!==1||typeof x.folder!=='string'||!path.isAbsolute(x.folder))throw new Error('Backup location settings are damaged; select a new folder');
  return x.folder;
 }
 async validate(folder:string):Promise<string>{
  if(!path.isAbsolute(folder))throw new Error('Backup folder must be an absolute path');
  const normalized=await fs.promises.realpath(folder);
  const root=await canonicalBackupPath(this.dataRoot);
  if(backupPathsOverlap(normalized,root))
    throw new Error('Choose a backup location separate from application data');
  if(!(await fs.promises.stat(normalized)).isDirectory())throw new Error('Backup location must be a directory');
  const probe=path.join(normalized,`.tm-folder-check-${crypto.randomBytes(8).toString('hex')}`);
  await fs.promises.writeFile(probe,'', {flag:'wx',mode:0o600});
  await fs.promises.rm(probe);
  return normalized;
 }
 async set(folder:string):Promise<string>{
  const checked=await this.validate(folder);
  await fs.promises.mkdir(path.dirname(this.preferenceFile),{recursive:true,mode:0o700});
  const temporary=this.preferenceFile+`.tmp-${crypto.randomBytes(8).toString('hex')}`;
  try{
    await fs.promises.writeFile(temporary,JSON.stringify({version:1,folder:checked})+'\n',{mode:0o600,flag:'wx'});
    await fs.promises.rename(temporary,this.preferenceFile);
  }finally{await fs.promises.rm(temporary,{force:true});}
  return checked;
 }
}
