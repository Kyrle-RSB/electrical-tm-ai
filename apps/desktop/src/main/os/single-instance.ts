import type {App,BrowserWindow} from 'electron';
/** Initial instance lock and second-instance focus policy. Never spawn another data owner. */
export function establishSingleInstance(application:App,getWindow:()=>BrowserWindow|undefined):boolean{
 if(!application.requestSingleInstanceLock())return false;
 application.on('second-instance',()=>{
  const win=getWindow();if(win){if(win.isMinimized())win.restore();win.show();win.focus();}
 });
 return true;
}
