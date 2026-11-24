import {CHANNELS,assertEnvelope,assertNoPayload,type AllowedChannel} from '../../../../../packages/contracts/src';
import type {ProjectStorePort,BusinessStorePort} from '../../../../../packages/application/src/ports/port-types';
import {isTrustedSender,type SenderEventLike,type WebContentsLike} from './sender-guard';
import {registerProjectHandlers} from './handlers/projects';
import {registerSettingsHandlers} from './handlers/settings';
/** Runtime-agnostic registration core; main passes actual Electron ipcMain and window. */
export interface HandlerRegistrar {handle(channel:string,handler:(event:SenderEventLike,request:unknown)=>Promise<unknown>):void}
export type ValidatedRegistrar=<T>(channel:AllowedChannel,validate:(value:unknown)=>T,operation:(requestId:string,payload:T)=>unknown)=>void;
export function registerFoundationHandlers(ipc:HandlerRegistrar,opts:{primary:WebContentsLike;url:string;getStore:()=>ProjectStorePort&BusinessStorePort}){
 const register:ValidatedRegistrar=(channel,validate,operation)=>ipc.handle(channel,async(event,request)=>{
  if(!isTrustedSender(event,opts.primary,opts.url))throw new Error('SECURITY: untrusted sender frame');
  assertEnvelope(request);
  return operation(request.requestId,validate(request.payload));
 });
 register(CHANNELS.ping,assertNoPayload,()=>({status:'ok',foundation:true}));
 registerProjectHandlers(register,opts.getStore);
 registerSettingsHandlers(register,opts.getStore);
}
