import type {SafeIpcErrorCode} from './error-envelope';
export const IPC_VERSION=1 as const;
export type IpcRequest<T> = { requestId: string; version: typeof IPC_VERSION; payload: T };
export type IpcResult<T> =
  | { ok: true; requestId: string; data: T }
  | { ok: false; requestId: string; error: {code:SafeIpcErrorCode;message:string;retryable:boolean;correlationId:string} };
const hexUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function assertEnvelope(v: unknown): asserts v is IpcRequest<unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('Invalid request envelope');
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length!==3||Object.keys(r).some(k => !['requestId','version','payload'].includes(k))) throw new Error('Invalid envelope properties');
  if (typeof r.requestId !== 'string' || !hexUuid.test(r.requestId)) throw new Error('Invalid request ID');
  if (r.version!==IPC_VERSION||!Object.prototype.hasOwnProperty.call(r,'payload')) throw new Error('Unsupported IPC version or missing payload');
  if (JSON.stringify(r).length > 16_384) throw new Error('IPC request exceeds size limit');
}
/** Session-scoped replay rejection. Never evict an accepted ID and then permit its replay. */
export function createRequestReplayGuard(limit=100000){
  const used=new Set<string>();
  return (id:string)=>{
    id=id.toLowerCase();
    if(used.has(id))throw new Error('SECURITY: duplicate IPC request ID');
    if(used.size>=limit)throw new Error('IPC session capacity unavailable; restart the application');
    used.add(id);
  };
}
export function validateProjectInput(v: unknown): { code: string; customer: string; siteAddress: string } {
  if (typeof v !== 'object' || !v || Array.isArray(v)) throw new Error('Expected project object');
  const d=v as Record<string, unknown>;
  if (Object.keys(d).some(k => !['code','customer','siteAddress'].includes(k))) throw new Error('Unsupported project field');
  const each=(k: string,max: number):string=>{
    const x=d[k]; if(typeof x!=='string' || x.trim().length<1 || x.trim().length>max) throw new Error(`Invalid ${k}`);
    return x.trim();
  };
  const code=each('code',60);
  if(!/^[A-Za-z0-9][\w./-]{0,59}$/.test(code)) throw new Error('Unsafe project code');
  return {code,customer:each('customer',200),siteAddress:each('siteAddress',300)};
}
export function assertNoPayload(v: unknown): void { if(v!==null && v!==undefined) throw new Error('No payload allowed'); }

export type BusinessInput={legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;taxId:string;contractorLicense:string};
function requirePlainRecord(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(typeof v!=='object'||!v||Array.isArray(v))throw new Error('Expected an object');
 const d=v as Record<string,unknown>;
 if(Object.keys(d).some(x=>!keys.includes(x)))throw new Error('Unexpected form field');
 return d;
}
function limitedText(v:unknown,max:number,required=false):string{
 if(typeof v!=='string'||v.length>max)throw new Error('Invalid text field');
 const x=v.trim();if(required&&!x)throw new Error('Field is required');return x;
}
export function validateBusinessInput(v:unknown):BusinessInput{
 const fields=['legalName','tradeName','phone','email','mailingAddress','taxId','contractorLicense'];
 const d=requirePlainRecord(v,fields);
 const output={legalName:limitedText(d.legalName,200,true),tradeName:limitedText(d.tradeName,200),
 phone:limitedText(d.phone,80),email:limitedText(d.email,254),mailingAddress:limitedText(d.mailingAddress,600),
 taxId:limitedText(d.taxId,100),contractorLicense:limitedText(d.contractorLicense,100)};
 if(output.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email))throw new Error('Invalid contact email');
 return output;
}
const ID=/^[a-f0-9-]{36}$/i;
export function validateProjectDetailsInput(v:unknown):{id:string;name:string;billingAddress:string;notes:string}{
 const d=requirePlainRecord(v,['id','name','billingAddress','notes']);
 const id=limitedText(d.id,36,true);
 if(!ID.test(id))throw new Error('Invalid project identity');
 return {id,name:limitedText(d.name,200),billingAddress:limitedText(d.billingAddress,600),notes:limitedText(d.notes,2000)};
}
export function validateProjectStatusInput(v:unknown):{id:string;status:'planned'|'active'|'on-hold'|'complete'|'closed'|'archived'}{
 const d=requirePlainRecord(v,['id','status']);const id=limitedText(d.id,36,true);
 if(!ID.test(id))throw new Error('Invalid project identity');
 if(typeof d.status!=='string'||!['planned','active','on-hold','complete','closed','archived'].includes(d.status))throw new Error('Invalid project status');
 return {id,status:d.status as 'planned'|'active'|'on-hold'|'complete'|'closed'|'archived'};
}

/** Editable fields for a project. Archiving is separate; issued records are never deleted. */
export function validateProjectEditInput(value:unknown):{id:string;code:string;customer:string;siteAddress:string}{
 const data=requirePlainRecord(value,['id','code','customer','siteAddress']);
 const id=limitedText(data.id,36,true);
 if(!ID.test(id))throw new Error('Invalid project identity');
 const fields=validateProjectInput({code:data.code,customer:data.customer,siteAddress:data.siteAddress});
 return {id,...fields};
}
