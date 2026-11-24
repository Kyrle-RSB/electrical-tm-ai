import {CHANNELS,assertNoPayload,validateProjectInput,validateProjectEditInput,validateProjectDetailsInput,validateProjectStatusInput} from '../../../../../../packages/contracts/src';
import {createProjectUseCases} from '../../../../../../packages/application/src/use-cases/projects';
import type {ProjectStorePort} from '../../../../../../packages/application/src/ports/port-types';
import type {ValidatedRegistrar} from '../register';
/** Privileged transport delegates orchestration to application use cases. */
export function registerProjectHandlers(register:ValidatedRegistrar,getStore:()=>ProjectStorePort){
 const useCases=()=>createProjectUseCases(getStore());
 register(CHANNELS.projectAdd,validateProjectInput,(id,payload)=>useCases().create(id,payload));
 register(CHANNELS.projectEdit,validateProjectEditInput,(id,payload)=>useCases().edit(id,payload));
 register(CHANNELS.projectList,assertNoPayload,()=>useCases().list());
 register(CHANNELS.projectDetailedList,assertNoPayload,()=>useCases().listDetailed());
 register(CHANNELS.projectDetails,validateProjectDetailsInput,(id,payload)=>useCases().details(id,payload));
 register(CHANNELS.projectStatus,validateProjectStatusInput,(id,payload)=>useCases().status(id,payload));
}
