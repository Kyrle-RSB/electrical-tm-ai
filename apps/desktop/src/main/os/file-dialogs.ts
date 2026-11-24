import path from 'node:path';
/** Narrow native-dialog boundary. Renderer cannot supply a destination path. */
export interface DialogAdapter {
 open(options:{properties:('openFile'|'openDirectory'|'createDirectory')[];filters?:{name:string;extensions:string[]}[]}):Promise<{canceled:boolean;filePaths:string[]}>;
 save(options:{defaultPath:string;filters:{name:string;extensions:string[]}[]}):Promise<{canceled:boolean;filePath?:string}>;
 confirm(options:{type:'warning';title:string;message:string;detail:string;buttons:string[];defaultId:number;cancelId:number}):Promise<{response:number}>;
}
export function createNativeFileDialogs(adapter:DialogAdapter){
 const one=(result:{canceled:boolean;filePaths:string[]})=>!result.canceled&&result.filePaths.length===1&&path.isAbsolute(result.filePaths[0])?result.filePaths[0]:null;
 return {
  pickReceipt:async()=>one(await adapter.open({properties:['openFile'],filters:[{name:'Receipt photo',extensions:['png','jpg','jpeg']}]})),
  chooseFolder:async(allowCreate:boolean)=>one(await adapter.open({properties:allowCreate?['openDirectory','createDirectory']:['openDirectory']})),
  choosePdf:async()=>{
   const result=await adapter.save({defaultPath:'synthetic-invoice-proof.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
   return !result.canceled&&result.filePath&&path.isAbsolute(result.filePath)?result.filePath:null;
  },
  confirmPdfReplace:async()=>(await adapter.confirm({type:'warning',title:'Replace existing synthetic PDF?',message:'A file with this name already exists.',detail:'Replace only this synthetic test PDF? This operation never edits issued invoice records.',buttons:['Keep existing file','Replace synthetic PDF'],defaultId:0,cancelId:0})).response===1,
  confirmRestore:async()=>(await adapter.confirm({type:'warning',title:'Restore synthetic records?',message:'Replace current local demo data with selected verified backup?',detail:'The current profile will be held in a separate rollback folder. Synthetic records only.',buttons:['Cancel','Restore demo data'],defaultId:0,cancelId:0})).response===1
 };
}
export type NativeFileDialogs=ReturnType<typeof createNativeFileDialogs>;
