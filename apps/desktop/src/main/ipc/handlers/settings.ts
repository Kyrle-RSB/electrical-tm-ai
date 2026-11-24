import {CHANNELS,assertNoPayload,validateBusinessInput} from '../../../../../../packages/contracts/src';
import type {BusinessStorePort} from '../../../../../../packages/application/src/ports/port-types';
import type {ValidatedRegistrar} from '../register';
export function registerSettingsHandlers(register:ValidatedRegistrar,getStore:()=>BusinessStorePort){
 register(CHANNELS.businessGet,assertNoPayload,()=>getStore().getBusinessProfile());
 register(CHANNELS.businessUpdate,validateBusinessInput,(id,payload)=>{
  const store=getStore();return store.mutateOnce(id,CHANNELS.businessUpdate,()=>{store.updateBusinessProfile(payload);return {updated:true};});
 });
}
