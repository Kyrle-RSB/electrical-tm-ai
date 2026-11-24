import {BrowserWindow} from 'electron';
import path from 'node:path';
/** Trusted platform window shell. Renderer has no direct Node or arbitrary IPC. */
export function createCockpitWindow(preloadDirectory:string,hidden=false):BrowserWindow{
 const win=new BrowserWindow({
   width:1120,height:760,minWidth:820,minHeight:560,
   backgroundColor:'#19232e',show:!hidden,
   webPreferences:{preload:path.join(preloadDirectory,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,
     webSecurity:true,webviewTag:false}
 });
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 return win;
}
