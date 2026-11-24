import {contextBridge,ipcRenderer} from 'electron';
import {CHANNELS,type AllowedChannel} from '../../../../packages/contracts/src/ipc/channel-map';
import {IPC_VERSION,type IpcResult} from '../../../../packages/contracts/src/ipc/request-envelope';
/** Sandboxed preload: expose a fixed set of functions, never ipcRenderer or Node globals. */
const invoke=async(channel:AllowedChannel,payload:unknown=null)=>{
  const requestId=crypto.randomUUID();
  const result:IpcResult<unknown>=await ipcRenderer.invoke(channel,{requestId,version:IPC_VERSION,payload});
  if(result?.ok===true&&result.requestId===requestId)return result.data;
  if(result?.ok===false&&typeof result.error?.message==='string')throw new Error(`${result.error.code}: ${result.error.message}`);
  throw new Error('INTERNAL: Invalid application response');
};
contextBridge.exposeInMainWorld('tmBridge',Object.freeze({
  ping:()=>invoke(CHANNELS.ping),
  createProject:(value:{code:string;customer:string;siteAddress:string})=>invoke(CHANNELS.projectAdd,value),
  updateProject:(value:{id:string;code:string;customer:string;siteAddress:string})=>invoke(CHANNELS.projectEdit,value),
  listProjects:()=>invoke(CHANNELS.projectList),
  listProjectsDetailed:()=>invoke(CHANNELS.projectDetailedList),
  updateProjectDetails:(value:{id:string;name:string;billingAddress:string;notes:string})=>invoke(CHANNELS.projectDetails,value),
  setProjectStatus:(value:{id:string;status:string})=>invoke(CHANNELS.projectStatus,value),
  getBusinessProfile:()=>invoke(CHANNELS.businessGet),
  updateBusinessProfile:(value:{legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;taxId:string;contractorLicense:string})=>invoke(CHANNELS.businessUpdate,value),
  importReceiptImage:()=>invoke(CHANNELS.fileImport),
  saveSyntheticPdf:()=>invoke(CHANNELS.pdfCreate),
  chooseBackupFolderAndBackUp:()=>invoke(CHANNELS.backupCreate),
  getBackupFolder:()=>invoke(CHANNELS.backupGetLocation),
  chooseBackupFolder:()=>invoke(CHANNELS.backupChooseLocation),
  backUpToSelectedFolder:()=>invoke(CHANNELS.backupCreateStored),
  chooseBackupAndRestore:()=>invoke(CHANNELS.backupRestore),
  storeFakeSecretProof:()=>invoke(CHANNELS.fakeSecretStore,'TEST-FAKE-EXAMPLE'),
  checkFakeSecretProof:()=>invoke(CHANNELS.fakeSecretCheck),
  removeFakeSecretProof:()=>invoke(CHANNELS.fakeSecretRemove)
}));
