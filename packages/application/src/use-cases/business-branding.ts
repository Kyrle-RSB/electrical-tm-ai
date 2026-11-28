import type {ManagedBusinessLogo,BusinessLogoStatus} from '../../../contracts/src/ipc/settings.contract';
import {CHANNELS} from '../../../contracts/src/ipc/channel-map';
import type {BusinessLogoStorePort} from '../ports/port-types';
/** User-selected image import is injected by the privileged desktop service. */
export function createBusinessBrandingUseCases(store:BusinessLogoStorePort,importSelected:()=>Promise<ManagedBusinessLogo|null>){
 return {
  get:()=>store.getBusinessLogo(),
  async choose(operationId:string):Promise<BusinessLogoStatus|null>{
   const asset=await importSelected();if(asset===null)return null;
   return store.mutateOnce(operationId,CHANNELS.businessLogoChoose,()=>{store.setBusinessLogo(asset);return store.getBusinessLogo();});
  },
  remove(operationId:string){return store.mutateOnce(operationId,CHANNELS.businessLogoRemove,()=>{store.removeBusinessLogo();return {removed:true};});}
 };
}
