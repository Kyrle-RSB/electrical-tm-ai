import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const MAX_CIPHERTEXT_BYTES=1024*1024;
function sameCredentialFile(a:fs.Stats|null,b:fs.Stats|null):boolean{
 if(a===null||b===null)return a===b;
 return a.isFile()&&b.isFile()&&a.nlink===1&&b.nlink===1&&a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
export interface AsyncProtection {
  isAsyncEncryptionAvailable():Promise<boolean>;
  encryptStringAsync(plain:string):Promise<Buffer>;
  decryptStringAsync(encrypted:Buffer):Promise<{result:string;shouldReEncrypt:boolean}>;
  getSelectedStorageBackend?():string;
}
/**
 * The Electron main process is the sole owner of this OS-protected secret file.
 * No plaintext fallback, no renderer access, and no secrets inside backups.
 */
export class ProtectedSecretFile {
  constructor(private readonly provider:AsyncProtection,private readonly file:string){}
  private async ensureAvailable(){
    if(!await this.provider.isAsyncEncryptionAvailable())throw new Error('Secure credential storage unavailable: fail closed');
    if(process.platform==='linux'&&this.provider.getSelectedStorageBackend?.()==='basic_text')
      throw new Error('Unprotected Linux credential backend is forbidden');
  }
  private async storageDirectory(create=false):Promise<boolean>{
    const directory=path.dirname(this.file);
    if(create)await fs.promises.mkdir(directory,{recursive:true,mode:0o700});
    try{
      const stat=await fs.promises.lstat(directory);
      if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe credential storage directory');
      return true;
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'&&!create)return false;throw error;}
  }
  private async inspectFile(){
    if(!await this.storageDirectory())return null;
    try{
      const stat=await fs.promises.lstat(this.file);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size===0||stat.size>MAX_CIPHERTEXT_BYTES)
        throw new Error('Unsafe credential storage file');
      return stat;
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  }
  async storeFakeToken(plaintext:string):Promise<void>{
    if(!plaintext.startsWith('TEST-FAKE-'))throw new Error('Proof rejects non-test credentials');
    await this.storeEncrypted(plaintext);
  }
  private async storeEncrypted(plaintext:string,expected?:fs.Stats):Promise<void>{
    await this.ensureAvailable();
    const before=await this.inspectFile();
    if(expected!==undefined&&!sameCredentialFile(expected,before))throw new Error('Unsafe credential storage file changed');
    const cipher=await this.provider.encryptStringAsync(plaintext);
    if(!Buffer.isBuffer(cipher)||!cipher.length||cipher.length>MAX_CIPHERTEXT_BYTES||cipher.includes(Buffer.from(plaintext,'utf8')))
      throw new Error('Credential encryption returned unsafe ciphertext');
    await this.storageDirectory(true);
    if(!sameCredentialFile(before,await this.inspectFile()))throw new Error('Unsafe credential storage file changed');
    const tmp=this.file+`.new-${crypto.randomBytes(8).toString('hex')}`;
    try {
      const handle=await fs.promises.open(tmp,'wx',0o600);
      try{await handle.writeFile(cipher);await handle.sync();}finally{await handle.close();}
      if(!sameCredentialFile(before,await this.inspectFile()))throw new Error('Unsafe credential storage file changed');
      await fs.promises.rename(tmp,this.file);
    }finally{await fs.promises.rm(tmp,{force:true});}
  }
  async exists():Promise<boolean>{return (await this.inspectFile())!==null;}
  async readFakeToken():Promise<string>{
    const value=await this.readEncrypted();
    if(!value.startsWith('TEST-FAKE-'))throw new Error('Invalid test token record');
    return value;
  }
  private async readEncrypted():Promise<string>{
    await this.ensureAvailable();
    const before=await this.inspectFile();
    if(!before)throw new Error('Protected credential not configured');
    const file=await fs.promises.open(this.file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
    let cipher:Buffer;
    try{
      const opened=await file.stat();
      if(!sameCredentialFile(before,opened))
        throw new Error('Unsafe credential storage file changed');
      cipher=Buffer.alloc(opened.size);
      let offset=0;
      while(offset<cipher.length){const {bytesRead}=await file.read(cipher,offset,cipher.length-offset,offset);if(!bytesRead)throw new Error('Unsafe credential storage file changed');offset+=bytesRead;}
      if(!sameCredentialFile(opened,await file.stat())||!sameCredentialFile(opened,await this.inspectFile()))throw new Error('Unsafe credential storage file changed');
    }finally{await file.close();}
    const {result,shouldReEncrypt}=await this.provider.decryptStringAsync(cipher);
    if(typeof result!=='string'||!result||result.length>65536)throw new Error('Invalid protected value');
    if(!sameCredentialFile(before,await this.inspectFile()))throw new Error('Unsafe credential storage file changed');
    if(shouldReEncrypt)await this.storeEncrypted(result,before);
    return result;
  }
  async remove():Promise<void>{if(await this.inspectFile())await fs.promises.rm(this.file,{force:true});}
  /** Caller MUST be a privileged application adapter. Never return this value via IPC. */
  static createProviderStore(provider:AsyncProtection,root:string){
    const names=new Set(['claude-api','gmail-oauth']);
    function fileFor(alias:string){
      if(!names.has(alias))throw new Error('Unknown protected-secret alias');
      return new ProtectedSecretFile(provider,path.join(root,`${alias}.bin`));
    }
    return {
      store:async(alias:string,plaintext:string)=>{
        if(typeof plaintext!=='string'||!plaintext||plaintext.length>65536)throw new Error('Invalid protected value');
        await fileFor(alias).storeEncrypted(plaintext);
      },
      read:async(alias:string)=>{const item=fileFor(alias);return await item.exists()?item.readEncrypted():null;},
      revoke:async(alias:string)=>fileFor(alias).remove(),
      isConfigured:async(alias:string)=>fileFor(alias).exists()
    };
  }
}
