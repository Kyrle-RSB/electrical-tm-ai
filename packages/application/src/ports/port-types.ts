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
 getProject(id:string):DetailedProject|null;
 updateProjectDetails(id:string,details:ProjectDetailsFields):void;
 setProjectStatus(id:string,status:ProjectState,reason?:string):void;
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

import type {BusinessLogoStatus,ManagedBusinessLogo} from '../../../contracts/src/ipc/settings.contract';
export interface BusinessLogoStorePort extends MutationPort {
 getBusinessLogo():BusinessLogoStatus|null;
 setBusinessLogo(asset:ManagedBusinessLogo):void;
 removeBusinessLogo():void;
}

import type {BackupListResult,BackupManifest} from '../../../contracts/src/ipc/settings.contract';
/** Filesystem choices are supplied only by the trusted main process. */
export interface BackupPort {
 create(folder:string):Promise<{backupPath:string;manifest:BackupManifest}>;
 list(folder:string):Promise<BackupListResult>;
 verify(folder:string):Promise<BackupManifest>;
 restore(folder:string,expectedIdentity:string):Promise<{rollbackPath:string|null}>;
}
