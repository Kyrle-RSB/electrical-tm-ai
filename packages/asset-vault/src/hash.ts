import crypto from 'node:crypto';
import fs from 'node:fs';
export function sha256Bytes(bytes:Buffer):string{return crypto.createHash('sha256').update(bytes).digest('hex');}
export async function sha256File(file:string):Promise<string>{return sha256Bytes(await fs.promises.readFile(file));}
