import fs from 'node:fs';
import {createHash} from 'node:crypto';
/** Executed inside the isolated --tm-smoke packaged runtime on native hosts only.
 * No renderer-provided code, external services or actual customer data. */
interface CockpitWindow {
 webContents:{executeJavaScript(code:string):Promise<unknown>;setZoomFactor(factor:number):void;getZoomFactor():number};
 getContentSize():number[];setContentSize(width:number,height:number):void;
}
type Theme='system'|'light'|'dark';
export async function runPackagedCockpitFlow(win:CockpitWindow,theme:{themeSource:Theme}){
 const evaluate=(code:string)=>win.webContents.executeJavaScript(code);
 const interaction=await evaluate(`(async()=>{
  const wait=async(predicate,label)=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,50));}throw new Error('Cockpit test failed: '+label);};
  const button=(root,label)=>root&&[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===label);
  const formByButton=label=>[...document.querySelectorAll('form')].find(form=>button(form,label));
  const set=async(form,label,value)=>{
   const field=[...form.querySelectorAll('label')].find(e=>e.firstChild?.textContent?.trim()===label)?.querySelector('input,textarea');
   if(!field)throw new Error('Synthetic form field missing');
   const proto=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto,'value').set.call(field,value);
   field.dispatchEvent(new Event('input',{bubbles:true}));
   await new Promise(r=>setTimeout(r,50));
   if(field.value!==value)throw new Error('Synthetic input update failed');
  };
  await wait(()=>formByButton('Save local business profile')&&formByButton('Create fictional project'),'initial forms');
  const business=formByButton('Save local business profile');
  await set(business,'Legal business name','Synthetic Cockpit Electric');
  button(business,'Save local business profile').click();
  await wait(async()=>(await window.tmBridge.getBusinessProfile()).legalName==='Synthetic Cockpit Electric','business profile save');
  const create=formByButton('Create fictional project');
  await set(create,'Project code','COCKPIT-UI-001');await set(create,'Customer','Synthetic UI Customer');await set(create,'Job-site address','1 UI Site Road');
  await set(create,'Billing address','2 UI Billing Road');await set(create,'Project name','Synthetic UI Flow');
  button(create,'Create fictional project').click();
  const row=()=>[...document.querySelectorAll('.project-list li')].find(e=>e.textContent.includes('COCKPIT-UI-001'));
  await wait(()=>row()?.textContent?.includes('2 UI Billing Road'),'project rendered');
  const first=(await window.tmBridge.listProjectsDetailed()).find(p=>p.project_code==='COCKPIT-UI-001');
  if(!first||first.site_address!=='1 UI Site Road'||first.billing_address!=='2 UI Billing Road')throw new Error('Created project fields differ');
  button(row(),'Edit').click();
  await wait(()=>row()?.querySelector('form'),'edit form');
  const edit=row().querySelector('form');await set(edit,'Billing address','3 UI Billing Road');
  button(edit,'Save changes').click();await wait(()=>row()?.textContent?.includes('3 UI Billing Road')&&!row().querySelector('form'),'edit saved');
  button(row(),'Archive').click();await wait(()=>button(row(),'Reopen'),'archived');
  button(row(),'Reopen').click();await wait(()=>button(row(),'Archive'),'reopened');
  const final=(await window.tmBridge.listProjectsDetailed()).find(p=>p.project_code==='COCKPIT-UI-001');
  if(final?.id!==first.id||final?.opened_utc!==first.opened_utc||final?.status!=='active'||final?.billing_address!=='3 UI Billing Road')throw new Error('Project identity changed');
  const help=button(document,'Help');help.click();await wait(()=>document.getElementById('help-region')&&document.activeElement?.textContent==='Close help','help focus');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await wait(()=>!document.getElementById('help-region')&&document.activeElement===help,'help escape and focus return');
  return {profileSaved:true,projectCreated:true,projectEdited:true,archiveReopen:true,stableIdentity:true,helpFocusReturn:true};
 })()`);
 const originalSize=win.getContentSize(),originalZoom=win.webContents.getZoomFactor(),originalTheme=theme.themeSource;
 const layouts:unknown[]=[];
 try{
  for(const [width,height] of [[1440,900],[1280,800]])for(const appearance of ['light','dark'] as const){
   theme.themeSource=appearance; // Synthetic automation override only; production follows system.
   win.setContentSize(width,height);win.webContents.setZoomFactor(2);
   const result=await evaluate(`(async()=>{
    const appearance=${JSON.stringify(appearance)},deadline=Date.now()+15000;
    while(Date.now()<deadline&&(!document.querySelector('.theme-indicator')?.textContent?.includes(appearance)||window.matchMedia('(prefers-color-scheme: dark)').matches!==(appearance==='dark')))await new Promise(r=>setTimeout(r,50));
    await new Promise(r=>setTimeout(r,250));
    const root=document.documentElement,viewport=root.clientWidth;
    const controls=[...document.querySelectorAll('button,input,textarea')].filter(e=>e.getClientRects().length);
    const overflow=root.scrollWidth>viewport+1||document.body.scrollWidth>viewport+1||controls.some(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>viewport+1;});
    const labels=controls.filter(e=>e.matches('input,textarea')).every(e=>!!e.labels?.length);
    if(overflow||!labels||!document.querySelector('.theme-indicator')?.textContent?.includes(appearance)||window.matchMedia('(prefers-color-scheme: dark)').matches!==(appearance==='dark'))throw new Error('Cockpit layout or theme check failed');
    return {appearance,viewportWidth:viewport,viewportHeight:root.clientHeight,overflow:false,labels:true};
   })()`);
   layouts.push({requestedWidth:width,requestedHeight:height,contentSize:win.getContentSize(),zoomFactor:win.webContents.getZoomFactor(),...(result as object)});
  }
 }finally{theme.themeSource=originalTheme;win.webContents.setZoomFactor(originalZoom);win.setContentSize(originalSize[0],originalSize[1]);}
 return {schema:'tm-cockpit-flow-v1',synthetic:true,interaction,layouts,note:'Packaged DOM interaction and simulated native appearance; physical keyboard, screen reader, contrast and OS-theme witness remain open.'};
}

/** This literal independent enumeration is cross-checked against the real bridge by the
 * foundation suite; it is never a transport exposed to the renderer. */
export const PACKAGED_SECURITY_METHODS=Object.freeze([
 'ping','createProject','updateProject','listProjects','listProjectsDetailed','updateProjectDetails','setProjectStatus',
 'getBusinessProfile','updateBusinessProfile','getBusinessLogo','chooseBusinessLogo','removeBusinessLogo',
 'importReceiptImage','saveSyntheticPdf','chooseBackupFolderAndBackUp','getBackupFolder','chooseBackupFolder',
 'backUpToSelectedFolder','chooseBackupAndRestore','storeFakeSecretProof','checkFakeSecretProof','removeFakeSecretProof'
]);
const SECURITY_CSP="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'";
/** Exact expression sent to the packaged renderer; independently executable in a JS-only fixture. */
export const RENDERER_ISOLATION_EXPRESSION=`({
 requireAbsent:typeof require==='undefined',processAbsent:typeof process==='undefined',
 bridgeKeys:Object.keys(window.tmBridge),csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content
})`;
/** Synthetic probe only. Bind bytes to the checked file and verify the named identity again.
 * Never follow an unchecked final symlink or read an unbounded synthetic fixture. */
export function hashSyntheticCensusFile(file:string,expected:fs.Stats):string{
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{
  const same=(stat:fs.Stats)=>stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.dev===expected.dev&&stat.ino===expected.ino&&stat.size===expected.size&&stat.mtimeMs===expected.mtimeMs&&stat.ctimeMs===expected.ctimeMs;
  if(expected.size>25*1024*1024||!same(expected)||!same(fs.fstatSync(fd))||!same(fs.lstatSync(file)))throw new Error('Synthetic census file identity changed');
  const hash=createHash('sha256'),buffer=Buffer.alloc(64*1024);let offset=0;
  while(offset<expected.size){const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,expected.size-offset),offset);if(!n)throw new Error('Synthetic census short read');hash.update(buffer.subarray(0,n));offset+=n;}
  if(!same(fs.fstatSync(fd))||!same(fs.lstatSync(file)))throw new Error('Synthetic census file identity changed');
  return hash.digest('hex');
 }finally{fs.closeSync(fd);}
}
interface SecurityWindow{
 webContents:{executeJavaScript(code:string,userGesture?:boolean):Promise<unknown>;getURL():string};
}
/** Electron 45.4.1 exposes this runtime accessor internally, not in the public
 * TypeScript declaration. It is used only by this isolated native proof.
 * Never substitute requested window configuration for observed runtime values. */
export function readPackagedRuntimePrefs(webContents:object){
 const getter:unknown=Reflect.get(webContents,'getLastWebPreferences');
 if(typeof getter!=='function')throw new Error('Native proof runtime preferences accessor unavailable');
 const prefs:unknown=Reflect.apply(getter,webContents,[]);
 if(typeof prefs!=='object'||prefs===null||Array.isArray(prefs))throw new Error('Native proof runtime preferences invalid');
 const read=(key:string):boolean=>{const value:unknown=Reflect.get(prefs,key);if(typeof value!=='boolean')throw new Error('Native proof missing runtime preference '+key);return value;};
 return {contextIsolation:read('contextIsolation'),nodeIntegration:read('nodeIntegration'),sandbox:read('sandbox'),webSecurity:read('webSecurity'),webviewTag:read('webviewTag')};
}
export async function runPackagedSecurityFlow(primary:SecurityWindow,foreign:SecurityWindow,projectId:string,snapshot:()=>string,navigationAttempts:()=>number){
 const baseline=snapshot();
 const project={code:'FOREIGN-SECURITY-PROBE',customer:'Synthetic denied',siteAddress:'Synthetic denied',details:{name:'Denied',billingAddress:'Denied',notes:'Denied'}};
 const profile={legalName:'Foreign denied',tradeName:'',phone:'',email:'',mailingAddress:'',taxId:'',contractorLicense:''};
 const input:Record<string,unknown[]>={createProject:[project],updateProject:[{id:projectId,...project}],updateProjectDetails:[{id:projectId,...project.details}],setProjectStatus:[{id:projectId,status:'archived'}],updateBusinessProfile:[profile]};
 const foreignResults=await foreign.webContents.executeJavaScript(`(async()=>{
  const methods=${JSON.stringify(PACKAGED_SECURITY_METHODS)},input=${JSON.stringify(input)};
  const results=[];
  for(const method of methods){
   try{await window.tmBridge[method](...(input[method]||[]));results.push({method,code:'ACCEPTED'});}
   catch(e){results.push({method,code:String(e).includes('SECURITY:')?'SECURITY':'OTHER'});}
  }
  return results;
 })()`);
 const malformedCases=[
  ['create-missing','createProject',{code:'INVALID'}],
  ['create-extra','createProject',{...project,ownerRole:'admin'}],
  ['create-oversize','createProject',{...project,customer:'x'.repeat(18000)}],
  ['create-unsafe-code','createProject',{...project,code:'../outside'}],
  ['edit-id','updateProject',{...project,id:'not-a-uuid'}],
  ['details-extra','updateProjectDetails',{id:projectId,...project.details,tenantId:'other'}],
  ['status-invalid','setProjectStatus',{id:projectId,status:'deleted'}],
  ['profile-extra','updateBusinessProfile',{...profile,ownerRole:'admin'}],
  ['profile-required','updateBusinessProfile',{...profile,legalName:''}]
 ];
 const malformedResults=await primary.webContents.executeJavaScript(`(async()=>{
  const results=[];
  for(const [id,method,input] of ${JSON.stringify(malformedCases)}){
   try{await window.tmBridge[method](input);results.push({id,code:'ACCEPTED'});}
   catch(e){results.push({id,code:String(e).includes('VALIDATION:')?'VALIDATION':'OTHER'});}
  }return results;
 })()`);
 const effectsAfterInvokes=snapshot()===baseline;
 const actualPrefs=readPackagedRuntimePrefs(primary.webContents);
 const isolation=await primary.webContents.executeJavaScript(RENDERER_ISOLATION_EXPRESSION);
 const security=await primary.webContents.executeJavaScript(`(async()=>{
  const events=[];const observe=e=>events.push({directive:e.effectiveDirective,blocked:e.blockedURI});
  document.addEventListener('securitypolicyviolation',observe);
  const inline=document.createElement('script');inline.textContent='window.__tmForbiddenInlineProbe=true';
  const frame=document.createElement('iframe');frame.hidden=true;frame.src='data:text/html,synthetic-probe';
  let networkBlocked=false,evalBlocked=false,permissionDenied=false;
  try{
   document.head.appendChild(inline);
   document.body.appendChild(frame);
   try{await fetch('tmapp://app/index.html');}catch{networkBlocked=true;}
   // String timers run through the page's normal CSP evaluation path, not main's injected script.
   try{setTimeout('window.__tmForbiddenEvalProbe=true',0);}catch{evalBlocked=true;}
   const win=window.open('tmapp://app/forbidden-popup','_blank');const popupDenied=win===null;if(win)win.close();
   const permission=await navigator.permissions.query({name:'notifications'});
   permissionDenied=permission.state==='denied'&&await Notification.requestPermission()==='denied';
   await new Promise(r=>setTimeout(r,300));
   evalBlocked=(evalBlocked||events.some(e=>e.directive==='script-src'&&e.blocked==='eval'))&&window.__tmForbiddenEvalProbe!==true;
   const inlineBlocked=window.__tmForbiddenInlineProbe!==true&&events.some(e=>e.directive==='script-src-elem'&&e.blocked==='inline');
   return {inlineBlocked,evalBlocked,networkBlocked:networkBlocked&&events.some(e=>e.directive==='connect-src'),frameBlocked:events.some(e=>e.directive==='frame-src'),popupDenied,permissionDenied,violations:[...new Set(events.map(e=>e.directive))].sort()};
  }finally{inline.remove();frame.remove();document.removeEventListener('securitypolicyviolation',observe);}
 })()`,true);
 const beforeUrl=primary.webContents.getURL(),beforeAttempts=navigationAttempts();
 await primary.webContents.executeJavaScript(`(()=>{const a=document.createElement('a');a.href='tmapp://app/forbidden-navigation';document.body.appendChild(a);a.click();a.remove();})()`,true);
 await new Promise(resolve=>setTimeout(resolve,300));
 const navigationAttempted=navigationAttempts()===beforeAttempts+1;
 const navigationDenied=navigationAttempted&&primary.webContents.getURL()===beforeUrl&&beforeUrl==='tmapp://app/index.html';
 const stateUnchanged=effectsAfterInvokes&&snapshot()===baseline;
 return {schema:'tm-renderer-security-v1',synthetic:true,foreignResults,malformedResults,stateUnchanged,actualPrefs,isolation,expectedCsp:SECURITY_CSP,security,navigationAttempted,navigationDenied};
}
