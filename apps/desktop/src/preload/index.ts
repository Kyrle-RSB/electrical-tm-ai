import {contextBridge,ipcRenderer} from 'electron';
import type {AllowedChannel} from '../../../../packages/contracts/src/ipc/channel-map';
import {IPC_VERSION,unwrapIpcResult} from '../../../../packages/contracts/src/ipc/request-envelope';
import {createBridge} from './bridge';
/** Sandboxed preload: expose fixed functions, never ipcRenderer or Node globals. */
const invoke=async<T>(channel:AllowedChannel,payload:unknown=null):Promise<T>=>{
 const requestId=crypto.randomUUID();
 const result:unknown=await ipcRenderer.invoke(channel,{requestId,version:IPC_VERSION,payload});
 return unwrapIpcResult(result,requestId) as T;
};
contextBridge.exposeInMainWorld('tmBridge',createBridge(invoke));
