import { CHANNELS, assertEnvelope, validateProjectInput, validateBusinessInput, validateProjectDetailsInput, validateProjectStatusInput, validateProjectEditInput, assertNoPayload } from '../../../../../packages/contracts/src';
import { LocalStore } from '../../../../../packages/persistence-sqlite/src/connection';
import { isTrustedSender, SenderEventLike, WebContentsLike } from './sender-guard';
/** Runtime-agnostic registration core; main passes actual Electron ipcMain and window. */
export interface HandlerRegistrar {handle(channel:string,handler:(event:SenderEventLike,request:unknown)=>Promise<unknown>):void}
export function registerFoundationHandlers(ipc:HandlerRegistrar,opts:{primary:WebContentsLike;url:string;getStore:()=>LocalStore}){
  const guard=(event:SenderEventLike,request:unknown,validator:(x:unknown)=>unknown)=>{
    if(!isTrustedSender(event,opts.primary,opts.url))throw new Error('SECURITY: untrusted sender frame');
    assertEnvelope(request);
    return validator(request.payload);
  };
  ipc.handle(CHANNELS.ping,async(e,r)=>{
    guard(e,r,assertNoPayload);
    return {status:'ok',foundation:true};
  });
  ipc.handle(CHANNELS.projectAdd,async(e,r)=>{
    const v=guard(e,r,validateProjectInput) as ReturnType<typeof validateProjectInput>;
    return {projectId:opts.getStore().createProject(v)};
  });
  ipc.handle(CHANNELS.projectEdit,async(e,r)=>{
    const {id,...input}=guard(e,r,validateProjectEditInput) as ReturnType<typeof validateProjectEditInput>;
    opts.getStore().updateProject(id,input);return {updated:true};
  });
  ipc.handle(CHANNELS.projectList,async(e,r)=>{
    guard(e,r,assertNoPayload);return opts.getStore().listProjects();
  });
  ipc.handle(CHANNELS.projectDetailedList,async(e,r)=>{
    guard(e,r,assertNoPayload);return opts.getStore().listProjectsDetailed();
  });
  ipc.handle(CHANNELS.projectDetails,async(e,r)=>{
    const {id,...details}=guard(e,r,validateProjectDetailsInput) as ReturnType<typeof validateProjectDetailsInput>;
    opts.getStore().updateProjectDetails(id,details);return {updated:true};
  });
  ipc.handle(CHANNELS.projectStatus,async(e,r)=>{
    const v=guard(e,r,validateProjectStatusInput) as ReturnType<typeof validateProjectStatusInput>;
    opts.getStore().setProjectStatus(v.id,v.status);return {updated:true};
  });
  ipc.handle(CHANNELS.businessGet,async(e,r)=>{
    guard(e,r,assertNoPayload);return opts.getStore().getBusinessProfile();
  });
  ipc.handle(CHANNELS.businessUpdate,async(e,r)=>{
    const v=guard(e,r,validateBusinessInput) as ReturnType<typeof validateBusinessInput>;
    opts.getStore().updateBusinessProfile(v);return {updated:true};
  });
}
