import {randomUUID} from 'node:crypto';
import {classifyIpcError} from '../../../../../packages/contracts/src/ipc/error-envelope';
import {ALL_CHANNELS,CHANNELS,assertEnvelope,assertNoPayload,createRequestReplayGuard,requestCorrelationId,type AllowedChannel,type IpcResult} from '../../../../../packages/contracts/src';
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

/** Actual main-process outer boundary. Existing inner handler guards remain defense in depth. */
export function createIpcBoundary(ipc:{handle(channel:string,handler:(event:SenderEventLike,...args:unknown[])=>Promise<IpcResult<unknown>>):void},opts:{primary:WebContentsLike;url:string;record:(event:string)=>void}){
 const claimRequest=createRequestReplayGuard();
 return (channel:string,handler:(event:SenderEventLike,request:unknown)=>Promise<unknown>)=>{
  if(!(ALL_CHANNELS as readonly string[]).includes(channel))throw new Error('IPC channel is outside the fixed allowlist');
  ipc.handle(channel,async(event,...args)=>{
   const request=args[0];let requestId=requestCorrelationId(request)??randomUUID();
   try{
    if(!isTrustedSender(event,opts.primary,opts.url))throw new Error('SECURITY: sender rejected');
    if(args.length!==1)throw new Error('Invalid IPC request argument count');
    assertEnvelope(request);requestId=request.requestId;claimRequest(requestId);
    return {ok:true,requestId,data:await handler(event,request)};
   }catch(error){
    const publicError=classifyIpcError(error);
    try{opts.record('ipc.'+publicError.code.toLowerCase());}catch{/* Diagnostic failure must not leak an exception or authorize a denied request. */}
    return {ok:false,requestId,error:{...publicError,retryable:publicError.code==='UNAVAILABLE',correlationId:requestId}};
   }
  });
 };
}
