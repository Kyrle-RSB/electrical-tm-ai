import type {SafeIpcErrorCode} from './error-envelope';
import type {ProjectInput,ProjectEditInput,ProjectDetailsInput,ProjectStatusInput,ProjectState,ProjectDetailsFields} from './projects.contract';
export const IPC_VERSION=1 as const;
export type IpcRequest<T> = { requestId: string; version: typeof IPC_VERSION; payload: T };
export type IpcResult<T> =
  | { ok: true; requestId: string; data: T }
  | { ok: false; requestId: string; error: {code:SafeIpcErrorCode;message:string;retryable:boolean;correlationId:string} };
const hexUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function plainRecord(value:unknown):value is Record<string,unknown>{
 if(typeof value!=='object'||value===null||Array.isArray(value))return false;
 const proto=Object.getPrototypeOf(value);
 return (proto===Object.prototype||proto===null)&&Reflect.ownKeys(value).every(k=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value,k),'value'));
}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]):boolean{
 return Object.keys(value).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));
}
/** Echo only a bounded, valid ID on rejection, without processing an untrusted payload. */
export function requestCorrelationId(value:unknown):string|null{
 if(typeof value!=='object'||value===null)return null;
 const id=Object.getOwnPropertyDescriptor(value,'requestId')?.value;
 return typeof id==='string'&&hexUuid.test(id)?id:null;
}
function assertBoundedPayload(value:unknown):void{
 let remaining=16384;
 const seen=new Set<object>();
 const visit=(v:unknown,depth:number)=>{
  if(depth>16||--remaining<0)throw new Error('IPC request exceeds size limit');
  if(v===null||v===undefined||typeof v==='boolean')return;
  if(typeof v==='string'){remaining-=v.length;if(remaining<0)throw new Error('IPC request exceeds size limit');return;}
  if(typeof v==='number'&&Number.isFinite(v))return;
  if(!plainRecord(v)&&!Array.isArray(v))throw new Error('Invalid IPC payload type');
  if(seen.has(v))throw new Error('Invalid cyclic IPC payload');
  seen.add(v);
  for(const k of Object.keys(v)){
   const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value' in d))throw new Error('Invalid IPC payload property');
   remaining-=k.length;if(remaining<0)throw new Error('IPC request exceeds size limit');visit(d.value,depth+1);
  }
  seen.delete(v);
 };
 visit(value,0);
 let serialized:string|undefined;
 try{serialized=JSON.stringify(value);}catch{throw new Error('Invalid IPC payload');}
 if((serialized?.length??0)>16384)throw new Error('IPC request exceeds size limit');
}
export function assertEnvelope(v: unknown): asserts v is IpcRequest<unknown> {
 if(!plainRecord(v)||!exactKeys(v,['requestId','version','payload']))throw new Error('Invalid request envelope properties');
 if(!requestCorrelationId(v))throw new Error('Invalid request ID');
 if(v.version!==IPC_VERSION)throw new Error('Unsupported IPC version');
 assertBoundedPayload(v);
}
/** Reject malformed or mismatched responses on both success and error paths. */
export function unwrapIpcResult(value:unknown,requestId:string):unknown{
 if(plainRecord(value)&&value.requestId===requestId&&hexUuid.test(requestId)){
  if(value.ok===true&&exactKeys(value,['ok','requestId','data']))return value.data;
  if(value.ok===false&&exactKeys(value,['ok','requestId','error'])&&plainRecord(value.error)){
   const e=value.error;
   if(exactKeys(e,['code','message','retryable','correlationId'])&&e.correlationId===requestId&&typeof e.code==='string'&&['VALIDATION','CONFLICT','SECURITY','UNAVAILABLE','INTERNAL'].includes(e.code)&&typeof e.message==='string'&&e.message.length<=512&&typeof e.retryable==='boolean')throw new Error(`${e.code}: ${e.message}`);
  }
 }
 throw new Error('INTERNAL: Invalid application response');
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
export function validateProjectInput(v: unknown): ProjectInput {
  if (!plainRecord(v)) throw new Error('Expected project object');
  const d=v as Record<string, unknown>;
  if (Object.keys(d).some(k => !['code','customer','siteAddress','details'].includes(k))) throw new Error('Unsupported project field');
  const each=(k: string,max: number):string=>{
    const x=d[k]; if(typeof x!=='string' || x.trim().length<1 || x.trim().length>max) throw new Error(`Invalid ${k}`);
    return x.trim();
  };
  const code=each('code',60);
  if(!/^[A-Za-z0-9][\w./-]{0,59}$/.test(code)) throw new Error('Unsafe project code');
  const base={code,customer:each('customer',200),siteAddress:each('siteAddress',300)};
  return Object.prototype.hasOwnProperty.call(d,'details')?{...base,details:validateDetailsFields(d.details)}:base;
}
export function assertNoPayload(v: unknown): void { if(v!==null && v!==undefined) throw new Error('No payload allowed'); }

export type BusinessInput={legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;taxId:string;contractorLicense:string};
function requirePlainRecord(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!plainRecord(v))throw new Error('Expected an object');
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
const ID=hexUuid;
function validateDetailsFields(v:unknown):ProjectDetailsFields{
 const d=requirePlainRecord(v,['name','billingAddress','notes']);
 return {name:limitedText(d.name,200),billingAddress:limitedText(d.billingAddress,600),notes:limitedText(d.notes,2000)};
}
export function validateProjectDetailsInput(v:unknown):ProjectDetailsInput{
 const d=requirePlainRecord(v,['id','name','billingAddress','notes']);
 const id=limitedText(d.id,36,true);
 if(!ID.test(id))throw new Error('Invalid project identity');
 return {id,...validateDetailsFields({name:d.name,billingAddress:d.billingAddress,notes:d.notes})};
}
export function validateProjectStatusInput(v:unknown):ProjectStatusInput{
 const d=requirePlainRecord(v,['id','status','reason']);const id=limitedText(d.id,36,true);
 if(!ID.test(id))throw new Error('Invalid project identity');
 if(typeof d.status!=='string'||!['planned','active','on-hold','complete','closed','archived'].includes(d.status))throw new Error('Invalid project status');
 return {id,status:d.status as ProjectState,...(Object.prototype.hasOwnProperty.call(d,'reason')?{reason:limitedText(d.reason,500,true)}:{})};
}

/** Editable fields for a project. Archiving is separate; issued records are never deleted. */
export function validateProjectEditInput(value:unknown):ProjectEditInput{
 const data=requirePlainRecord(value,['id','code','customer','siteAddress','details']);
 const id=limitedText(data.id,36,true);
 if(!ID.test(id))throw new Error('Invalid project identity');
 const fields=validateProjectInput({code:data.code,customer:data.customer,siteAddress:data.siteAddress,...(Object.prototype.hasOwnProperty.call(data,'details')?{details:data.details}:{})});
 return {id,...fields};
}
