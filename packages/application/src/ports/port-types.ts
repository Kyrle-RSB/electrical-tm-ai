import type {BusinessInput} from '../../../contracts/src/ipc/request-envelope';
import type {ProjectInput,ProjectData,DetailedProject,ProjectDetailsFields,ProjectState} from '../../../contracts/src/ipc/projects.contract';
/** Ports for local, authorized operations. Does not import Electron, React, DB, or AI. */
export type LocalIdentity={businessId:'local';actor:'local-operator'};
export interface TransactionPort {atomic<T>(work:()=>T):T}
export interface AuditPort {append(event:{action:string;entityId:string;occurredUtc:string}):void}
export interface MutationPort {mutateOnce<T>(operationId:string,channel:string,action:()=>T):T}
export interface ProjectStorePort extends MutationPort {
 createProject(input:ProjectInput):string;
 updateProject(id:string,input:ProjectInput):void;
 listProjects():ProjectData[];
 listProjectsDetailed():DetailedProject[];
 updateProjectDetails(id:string,details:ProjectDetailsFields):void;
 setProjectStatus(id:string,status:ProjectState):void;
}
export interface BusinessStorePort extends MutationPort {
 getBusinessProfile():BusinessInput&{currency:string};
 updateBusinessProfile(input:BusinessInput):void;
}
export interface AttachmentPort {
 importReceipt(source:string):Promise<{id:string;sha256:string;relativePath:string}>;
}
export interface ProtectedSecretPort {
 set(alias:string,value:string):Promise<void>;
 read(alias:string):Promise<string|null>;
 revoke(alias:string):Promise<void>;
}
