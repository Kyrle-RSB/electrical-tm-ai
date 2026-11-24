/** Ports for local, authorized operations. Does not import Electron, React, DB, or AI. */
export type LocalIdentity={businessId:'local';actor:'local-operator'};
export interface TransactionPort {atomic<T>(work:()=>T):T}
export interface AuditPort {append(event:{action:string;entityId:string;occurredUtc:string}):void}
export interface BusinessStorePort {
 getBusinessProfile():unknown;
 createProject(input:{code:string;customer:string;siteAddress:string}):string;
 listProjectsDetailed():unknown[];
}
export interface AttachmentPort {
 importReceipt(source:string):Promise<{id:string;sha256:string;relativePath:string}>;
}
export interface ProtectedSecretPort {
 set(alias:string,value:string):Promise<void>;
 read(alias:string):Promise<string|null>;
 revoke(alias:string):Promise<void>;
}
