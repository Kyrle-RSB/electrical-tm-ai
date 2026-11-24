import type {BusinessLogoStatus} from '../../../../packages/contracts/src/ipc/settings.contract';
import {CHANNELS,type AllowedChannel} from '../../../../packages/contracts/src/ipc/channel-map';
import type {ProjectInput,ProjectEditInput,ProjectDetailsInput,ProjectStatusInput,ProjectData,DetailedProject} from '../../../../packages/contracts/src/ipc/projects.contract';
import type {BusinessInput} from '../../../../packages/contracts/src/ipc/request-envelope';
/** Fixed, typed surface; callers cannot choose arbitrary transport channels. */
export type BridgeTransport=<T>(channel:AllowedChannel,payload?:unknown)=>Promise<T>;
export function createBridge(invoke:BridgeTransport){return Object.freeze({
 ping:()=>invoke<{status:string;foundation:boolean}>(CHANNELS.ping),
 createProject:(value:ProjectInput)=>invoke<{projectId:string}>(CHANNELS.projectAdd,value),
 updateProject:(value:ProjectEditInput)=>invoke<{updated:boolean}>(CHANNELS.projectEdit,value),
 listProjects:()=>invoke<ProjectData[]>(CHANNELS.projectList),
 listProjectsDetailed:()=>invoke<DetailedProject[]>(CHANNELS.projectDetailedList),
 updateProjectDetails:(value:ProjectDetailsInput)=>invoke<{updated:boolean}>(CHANNELS.projectDetails,value),
 setProjectStatus:(value:ProjectStatusInput)=>invoke<{updated:boolean}>(CHANNELS.projectStatus,value),
 getBusinessProfile:()=>invoke<BusinessInput&{currency:string}>(CHANNELS.businessGet),
 updateBusinessProfile:(value:BusinessInput)=>invoke<{updated:boolean}>(CHANNELS.businessUpdate,value),
 getBusinessLogo:()=>invoke<BusinessLogoStatus|null>(CHANNELS.businessLogoGet),
 chooseBusinessLogo:()=>invoke<BusinessLogoStatus|null>(CHANNELS.businessLogoChoose),
 removeBusinessLogo:()=>invoke<{removed:boolean}>(CHANNELS.businessLogoRemove),
 importReceiptImage:()=>invoke<unknown>(CHANNELS.fileImport),
 saveSyntheticPdf:()=>invoke<string|null>(CHANNELS.pdfCreate),
 chooseBackupFolderAndBackUp:()=>invoke<unknown>(CHANNELS.backupCreate),
 getBackupFolder:()=>invoke<{folder:string|null}>(CHANNELS.backupGetLocation),
 chooseBackupFolder:()=>invoke<{folder:string}|null>(CHANNELS.backupChooseLocation),
 backUpToSelectedFolder:()=>invoke<{backupPath:string;manifest:unknown}>(CHANNELS.backupCreateStored),
 chooseBackupAndRestore:()=>invoke<unknown>(CHANNELS.backupRestore),
 storeFakeSecretProof:()=>invoke<unknown>(CHANNELS.fakeSecretStore,'TEST-FAKE-EXAMPLE'),
 checkFakeSecretProof:()=>invoke<unknown>(CHANNELS.fakeSecretCheck),
 removeFakeSecretProof:()=>invoke<unknown>(CHANNELS.fakeSecretRemove)
});}
export type TmBridge=ReturnType<typeof createBridge>;
