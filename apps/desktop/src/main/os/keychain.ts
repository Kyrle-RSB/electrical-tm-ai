import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  async storeFakeToken(plaintext:string):Promise<void>{
    if(!plaintext.startsWith('TEST-FAKE-'))throw new Error('Proof rejects non-test credentials');
    await this.storeEncrypted(plaintext);
  }
  private async storeEncrypted(plaintext:string):Promise<void>{
    await this.ensureAvailable();
    const cipher=await this.provider.encryptStringAsync(plaintext);
    if(!cipher.length||cipher.includes(Buffer.from(plaintext,'utf8')))
      throw new Error('Credential encryption returned unsafe ciphertext');
    await fs.promises.mkdir(path.dirname(this.file),{recursive:true,mode:0o700});
    const tmp=this.file+`.new-${crypto.randomBytes(8).toString('hex')}`;
    try {
      const handle=await fs.promises.open(tmp,'wx',0o600);
      try{await handle.writeFile(cipher);await handle.sync();}finally{await handle.close();}
      await fs.promises.rename(tmp,this.file);
    }finally{await fs.promises.rm(tmp,{force:true});}
  }
  async exists():Promise<boolean>{return fs.existsSync(this.file);}
  async readFakeToken():Promise<string>{
    const value=await this.readEncrypted();
    if(!value.startsWith('TEST-FAKE-'))throw new Error('Invalid test token record');
    return value;
  }
  private async readEncrypted():Promise<string>{
    await this.ensureAvailable();
    const cipher=await fs.promises.readFile(this.file);
    const {result,shouldReEncrypt}=await this.provider.decryptStringAsync(cipher);
    if(shouldReEncrypt)await this.storeEncrypted(result);
    return result;
  }
  async remove():Promise<void>{await fs.promises.rm(this.file,{force:true});}
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
