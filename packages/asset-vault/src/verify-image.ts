import {validateImageBytes} from './import-file';
import {sha256Bytes} from './hash';
import {resolveManagedImage,assertManagedImageDirectory,readRegularImage} from './resolve-managed-asset';
export async function verifyManagedImage(root:string,relativePath:string,expectedSha256:string):Promise<{mime:string;bytes:number}>{
 if(!/^[a-f0-9]{64}$/i.test(expectedSha256))throw new Error('Invalid expected image hash');
 const file=resolveManagedImage(root,relativePath);
 await assertManagedImageDirectory(root);
 const bytes=await readRegularImage(file);
 if(sha256Bytes(bytes)!==expectedSha256.toLowerCase())throw new Error('Managed image hash mismatch');
 const mime=validateImageBytes(bytes);
 if(relativePath.endsWith('.png')&&mime!=='image/png'||relativePath.endsWith('.jpg')&&mime!=='image/jpeg')throw new Error('Managed image extension mismatch');
 return {mime,bytes:bytes.length};
}
