import {CHANNELS} from '../../../contracts/src/ipc/channel-map';
import {validateProjectIdentity} from '../../../contracts/src/ipc/request-envelope';
import type {ProjectInput,ProjectEditInput,ProjectDetailsInput,ProjectStatusInput} from '../../../contracts/src/ipc/projects.contract';
import type {ProjectStorePort} from '../ports/port-types';
/** Application-owned project operations; storage and mutation receipts remain atomic in the adapter. */
export function createProjectUseCases(store:ProjectStorePort){
 return {
  create:(operationId:string,input:ProjectInput)=>store.mutateOnce(operationId,CHANNELS.projectAdd,()=>({projectId:store.createProject(input)})),
  edit:(operationId:string,{id,...input}:ProjectEditInput)=>store.mutateOnce(operationId,CHANNELS.projectEdit,()=>{store.updateProject(id,input);return {updated:true};}),
  list:()=>store.listProjects(),
  listDetailed:()=>store.listProjectsDetailed(),
  get:(id:unknown)=>store.getProject(validateProjectIdentity(id)),
  details:(operationId:string,{id,...input}:ProjectDetailsInput)=>store.mutateOnce(operationId,CHANNELS.projectDetails,()=>{store.updateProjectDetails(id,input);return {updated:true};}),
  status:(operationId:string,input:ProjectStatusInput)=>store.mutateOnce(operationId,CHANNELS.projectStatus,()=>{store.setProjectStatus(input.id,input.status,input.reason);return {updated:true};})
 };
}
