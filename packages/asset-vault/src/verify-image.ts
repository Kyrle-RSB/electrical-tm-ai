import fs from 'node:fs';
import {validateImageBytes} from './import-file';
import {sha256Bytes} from './hash';
import {resolveManagedImage} from './resolve-managed-asset';
export async function verifyManagedImage(root:string,relativePath:string,expectedSha256:string):Promise<{mime:string;bytes:number}>{
 if(!/^[a-f0-9]{64}$/i.test(expectedSha256))throw new Error('Invalid expected image hash');
 const file=resolveManagedImage(root,relativePath);
 const stat=await fs.promises.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Managed image must be regular file');
 const bytes=await fs.promises.readFile(file);
 const mime=validateImageBytes(bytes);
 if(sha256Bytes(bytes)!==expectedSha256.toLowerCase())throw new Error('Managed image hash mismatch');
 if(relativePath.endsWith('.png')&&mime!=='image/png'||relativePath.endsWith('.jpg')&&mime!=='image/jpeg')throw new Error('Managed image extension mismatch');
 return {mime,bytes:bytes.length};
}
