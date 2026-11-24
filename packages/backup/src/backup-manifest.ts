import type {DatabaseSync} from 'node:sqlite';

export type Manifest = {schema:'tm-phase1-backup-v1';createdUtc:string;files:Array<{path:string;bytes:number;sha256:string}>;excluded:string[]};
/** Portable relative paths: no Windows alternate streams, aliases or reserved device names. */
export function isPortableBackupPath(value:string):boolean {
 return value.length>0&&value.length<=1024&&value.split('/').every(part=>
  part.length>0&&part.length<=255&&part!=='.'&&part!=='..'&&
  !/[<>:"\\|?*\u0000-\u001f\u007f]/.test(part)&&!/[ .]$/.test(part)&&
  !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
export function validateManifest(value:unknown):Manifest {
 if(!value||typeof value!=='object')throw new Error('Unsupported backup manifest');
 const m=value as Manifest;
 if(m.schema!=='tm-phase1-backup-v1'||!Array.isArray(m.files)||m.files.length===0||m.files.length>10000)throw new Error('Unsupported backup manifest');
 if(typeof m.createdUtc!=='string'||!Number.isFinite(Date.parse(m.createdUtc))||!Array.isArray(m.excluded)||m.excluded.some(x=>typeof x!=='string'))throw new Error('Malformed backup metadata');
 const listed=new Set<string>();
 for(const e of m.files){
  if(!e||typeof e.path!=='string'||!isPortableBackupPath(e.path)||!(/^(db\/app\.sqlite|vault\/.+|artifacts\/.+)$/).test(e.path))throw new Error('Unsafe backup manifest path');
  const key=e.path.normalize('NFC').toLowerCase();
  if(listed.has(key))throw new Error('Unsafe backup manifest path: duplicate portable name');
  listed.add(key);
  if(!Number.isSafeInteger(e.bytes)||e.bytes<0||typeof e.sha256!=='string'||!/^[0-9a-f]{64}$/.test(e.sha256))throw new Error('Malformed backup file entry');
 }
 if(!m.files.some(e=>e.path==='db/app.sqlite'))throw new Error('Backup missing SQLite database');
 return m;
}
/** A syntactically intact manifest is insufficient: all durable document references must resolve. */
export function assertReferencedEvidence(db:DatabaseSync,manifest:Manifest):void {
 const entries=new Map(manifest.files.map(e=>[e.path,e.sha256]));
 const exists=(table:string)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
 const check=(prefix:string,locator:unknown,digest:unknown,optional=false)=>{
  if(optional&&locator===null&&digest===null)return;
  if(typeof locator!=='string'||!isPortableBackupPath(locator)||typeof digest!=='string'||!/^[0-9a-f]{64}$/.test(digest)||entries.get(prefix+'/'+locator)!==digest)
   throw new Error('Referenced backup evidence missing or altered');
 };
 if(exists('business_logo_assets'))for(const row of db.prepare('SELECT vault_locator,sha256 FROM business_logo_assets').all())check('vault',row.vault_locator,row.sha256);
 if(exists('purchase_sources'))for(const row of db.prepare('SELECT vault_locator,source_hash FROM purchase_sources').all())check('vault',row.vault_locator,row.source_hash);
 if(exists('issued_invoices'))for(const row of db.prepare('SELECT pdf_locator,pdf_sha256 FROM issued_invoices').all())check('artifacts',row.pdf_locator,row.pdf_sha256);
 if(exists('payment_receipts'))for(const row of db.prepare('SELECT pdf_locator,pdf_sha256 FROM payment_receipts').all())check('artifacts',row.pdf_locator,row.pdf_sha256,true);
}
