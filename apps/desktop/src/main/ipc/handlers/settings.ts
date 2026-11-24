import {CHANNELS,assertNoPayload,validateBusinessInput} from '../../../../../../packages/contracts/src';
import type {BusinessStorePort} from '../../../../../../packages/application/src/ports/port-types';
import type {ValidatedRegistrar} from '../register';
export function registerSettingsHandlers(register:ValidatedRegistrar,getStore:()=>BusinessStorePort){
 register(CHANNELS.businessGet,assertNoPayload,()=>getStore().getBusinessProfile());
 register(CHANNELS.businessUpdate,validateBusinessInput,(id,payload)=>{
  const store=getStore();return store.mutateOnce(id,CHANNELS.businessUpdate,()=>{store.updateBusinessProfile(payload);return {updated:true};});
 });
}

import {createBusinessBrandingUseCases} from '../../../../../../packages/application/src/use-cases/business-branding';
import type {BusinessLogoStorePort} from '../../../../../../packages/application/src/ports/port-types';
import type {ManagedBusinessLogo} from '../../../../../../packages/contracts/src/ipc/settings.contract';
export function registerBrandingHandlers(register:ValidatedRegistrar,getStore:()=>BusinessLogoStorePort,importSelected:()=>Promise<ManagedBusinessLogo|null>){
 const useCases=()=>createBusinessBrandingUseCases(getStore(),importSelected);
 register(CHANNELS.businessLogoGet,assertNoPayload,()=>useCases().get());
 register(CHANNELS.businessLogoChoose,assertNoPayload,id=>useCases().choose(id));
 register(CHANNELS.businessLogoRemove,assertNoPayload,id=>useCases().remove(id));
}
