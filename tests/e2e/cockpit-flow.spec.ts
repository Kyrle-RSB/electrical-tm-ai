import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {ALL_CHANNELS,CHANNELS} from '../../packages/contracts/src/ipc/channel-map';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
/** Executed inside the isolated --tm-smoke packaged runtime on native hosts only.
 * No renderer-provided code, external services or actual customer data. */
interface CockpitWindow {
 webContents:{executeJavaScript(code:string):Promise<unknown>;setZoomFactor(factor:number):void;getZoomFactor():number;sendInputEvent(event:{type:'keyDown'|'keyUp';keyCode:string}):void};
 show():void;focus():void;isVisible():boolean;isFocused():boolean;hide():void;
 getContentSize():number[];setContentSize(width:number,height:number):void;capturePage():Promise<{isEmpty():boolean;getSize():{width:number;height:number};toPNG():Buffer}>;
}
type Theme='system'|'light'|'dark';
/** WCAG luminance ratio for flat computed RGB(A) paints. Unsupported paints fail closed. */
export function contrastForPaint(foreground:string,layers:string[]):number{
 const parse=(value:string)=>{
  const m=/^rgba?\(([^)]+)\)$/.exec(value);
  if(!m)throw new Error('Unsupported computed color');
  const a=m[1].split(',').map(x=>Number(x.trim()));
  if(![3,4].includes(a.length)||a.some(x=>!Number.isFinite(x))||a.slice(0,3).some(x=>x<0||x>255)||(a.length===4&&(a[3]<0||a[3]>1)))throw new Error('Invalid computed color');
  return [a[0],a[1],a[2],a[3]??1];
 };
 const overlay=(base:number[],paint:number[])=>base.map((x,i)=>x*(1-paint[3])+paint[i]*paint[3]);
 const bg=layers.reduce((base,layer)=>overlay(base,parse(layer)),[255,255,255]);
 const fg=overlay(bg,parse(foreground));
 const luminance=(c:number[])=>c.map(x=>{const v=x/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
 const a=luminance(bg),b=luminance(fg);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
export async function runPackagedCockpitFlow(win:CockpitWindow,theme:{themeSource:Theme},capture:(name:string,bytes:Buffer)=>void,progress:(stage:string,diagnostics?:{textChecks:number;minTextRatio:number;minLargeRatio:number;focusRatio:number;focusVisible:boolean;worstTag:string;worstClass:string}|{requested:number[];actual:number[];visible:boolean;focused:boolean}|{imageSize:number[];bytes:number;empty:boolean})=>void=()=>{}){
 const evaluate=(code:string)=>win.webContents.executeJavaScript(code);
 progress('interaction');
 const interaction=await evaluate(`(async()=>{
  let stage='initial';
  try{
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
  const originalProfile=await window.tmBridge.getBusinessProfile();
  const originalRows=await window.tmBridge.listProjectsDetailed();
  const field=(form,label)=>[...form.querySelectorAll('label')].find(e=>e.firstChild?.textContent?.trim()===label)?.querySelector('input,textarea');
  stage='tax-length';
  await set(business,'Tax registration ID','x'.repeat(101));
  button(business,'Save local business profile').click();
  await wait(()=>business.parentElement.textContent.includes('Could not save:'),'invalid tax length safe error');
  if(JSON.stringify(await window.tmBridge.getBusinessProfile())!==JSON.stringify(originalProfile))throw new Error('Rejected tax edit mutated profile');
  stage='profile-save';
  await set(business,'Tax registration ID',originalProfile.taxId);
  await set(business,'Legal business name','Synthetic Cockpit Electric');
  button(business,'Save local business profile').click();
  await wait(async()=>(await window.tmBridge.getBusinessProfile()).legalName==='Synthetic Cockpit Electric','business profile save');
  stage='required-customer';
  const create=formByButton('Create fictional project');
  await set(create,'Project code','COCKPIT-UI-001');await set(create,'Customer','');
  if(!field(create,'Customer')?.validity.valueMissing)throw new Error('Required customer validation absent');
  button(create,'Create fictional project').click();await new Promise(r=>setTimeout(r,100));
  if(JSON.stringify(await window.tmBridge.listProjectsDetailed())!==JSON.stringify(originalRows))throw new Error('Missing customer mutated projects');
  stage='project-create';
  await set(create,'Customer','Synthetic UI Customer');await set(create,'Job-site address','1 UI Site Road');
  await set(create,'Billing address','2 UI Billing Road');await set(create,'Project name','Synthetic UI Flow');
  button(create,'Create fictional project').click();
  const row=()=>[...document.querySelectorAll('.project-list li')].find(e=>e.textContent.includes('COCKPIT-UI-001'));
  await wait(()=>row()?.textContent?.includes('2 UI Billing Road'),'project rendered');
  const first=(await window.tmBridge.listProjectsDetailed()).find(p=>p.project_code==='COCKPIT-UI-001');
  if(!first||first.site_address!=='1 UI Site Road'||first.billing_address!=='2 UI Billing Road')throw new Error('Created project fields differ');
  stage='duplicate';
  await wait(()=>!button(create,'Create fictional project')?.disabled,'creation settled');
  button(create,'Create fictional project').click();
  await wait(()=>document.querySelector('.feedback')?.textContent?.includes('Create project failed:'),'duplicate project error');
  if((await window.tmBridge.listProjectsDetailed()).length!==originalRows.length+1)throw new Error('Duplicate project mutated rows');
  stage='cancel-edit';
  button(row(),'Edit').click();await wait(()=>row()?.querySelector('form'),'cancel edit form');
  await set(row().querySelector('form'),'Billing address','CANCELLED BILLING');button(row(),'Cancel').click();
  await wait(()=>!row().querySelector('form'),'cancel edit');
  if(JSON.stringify((await window.tmBridge.listProjectsDetailed()).find(p=>p.id===first.id))!==JSON.stringify(first))throw new Error('Cancelled edit mutated project');
  stage='edit';
  button(row(),'Edit').click();
  await wait(()=>row()?.querySelector('form'),'edit form');
  const edit=row().querySelector('form');await set(edit,'Billing address','3 UI Billing Road');
  const longNotes='LONGSYNTHETIC'.repeat(45);await set(edit,'Project notes',longNotes);
  button(edit,'Save changes').click();await wait(()=>row()?.textContent?.includes('3 UI Billing Road')&&!row().querySelector('form'),'edit saved');
  stage='cancel-status';
  await wait(()=>!button(row(),'Archive')?.disabled,'edit settled');
  button(row(),'Archive').click();await wait(()=>formByButton('Confirm archive'),'archive form');
  const beforeCancel=(await window.tmBridge.listProjectsDetailed()).find(p=>p.id===first.id);
  if(!field(formByButton('Confirm archive'),'Status reason')?.validity.valueMissing)throw new Error('Required reason validation absent');
  await set(formByButton('Confirm archive'),'Status reason','CANCELLED REASON');
  button(row(),'Cancel status change').click();await wait(()=>!row().querySelector('form'),'cancel status');
  if(JSON.stringify((await window.tmBridge.listProjectsDetailed()).find(p=>p.id===first.id))!==JSON.stringify(beforeCancel))throw new Error('Cancelled transition mutated project');
  stage='archive';
  button(row(),'Archive').click();await wait(()=>formByButton('Confirm archive'),'archive form reopened');
  await set(formByButton('Confirm archive'),'Status reason','Synthetic UI archive reason');
  button(row(),'Confirm archive').click();await wait(()=>button(row(),'Reopen')&&!row().querySelector('form'),'archived');
  stage='reopen';
  await wait(()=>!button(row(),'Reopen')?.disabled,'archive settled');
  button(row(),'Reopen').click();await wait(()=>formByButton('Confirm reopen'),'reopen form');
  await set(formByButton('Confirm reopen'),'Status reason','Synthetic UI reopen reason');
  button(row(),'Confirm reopen').click();await wait(()=>button(row(),'Archive')&&!row().querySelector('form'),'reopened');
  stage='identity';
  const final=(await window.tmBridge.listProjectsDetailed()).find(p=>p.project_code==='COCKPIT-UI-001');
  if(final?.id!==first.id||final?.opened_utc!==first.opened_utc||final?.status!=='active'||final?.billing_address!=='3 UI Billing Road'||final?.notes!==longNotes)throw new Error('Project identity changed');
  stage='help';
  const help=button(document,'Help');help.click();await wait(()=>document.getElementById('help-region')&&document.activeElement?.textContent==='Close help','help focus');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await wait(()=>!document.getElementById('help-region')&&document.activeElement===help,'help escape and focus return');
  stage='disabled-backup';
  const backup=button(document,'Back up now');
  if(!backup?.disabled||!document.querySelector('[aria-labelledby=backup-title]')?.textContent?.includes('Choose a backup folder before creating a backup.'))throw new Error('Disabled backup reason absent');
  return {profileSaved:true,projectCreated:true,projectEdited:true,archiveReopen:true,stableIdentity:true,helpFocusReturn:true,duplicateDenied:true,missingCustomerDenied:true,taxLengthDenied:true,cancelEdit:true,cancelStatus:true,longContent:true,disabledReason:true,projectId:first.id};
  }catch{ return {syntheticFailureStage:stage}; }
 })()`);
 const failedStage=(interaction as {syntheticFailureStage?:string})?.syntheticFailureStage;
 if(failedStage){if(['initial','tax-length','profile-save','required-customer','project-create','duplicate','cancel-edit','edit','cancel-status','archive','reopen','identity','help','disabled-backup'].includes(failedStage))progress(failedStage);throw new Error('Synthetic cockpit interaction failed');}
 const originalSize=win.getContentSize(),originalZoom=win.webContents.getZoomFactor(),originalTheme=theme.themeSource,originalVisible=win.isVisible();
 const layouts:unknown[]=[];
 try{
  for(const [width,height] of [[1440,900],[1280,800]])for(const appearance of ['light','dark'] as const){
   progress('layout-'+width+'x'+height+'-'+appearance);
   theme.themeSource=appearance; // Synthetic automation override only; production follows system.
   win.setContentSize(width,height);win.webContents.setZoomFactor(2);
   // Exercise real Chromium keyboard modality in the runner-owned synthetic window.
   win.show();win.focus();
   win.setContentSize(width,height);
   await evaluate(`(async()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);await new Promise(r=>setTimeout(r,100));})()`);
   let keyboardInput=false;
   for(let i=0;i<80;i++){
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});
    await new Promise(r=>setTimeout(r,40));
    if(await evaluate(`document.activeElement?.matches('input:not(:disabled),textarea:not(:disabled)')===true && document.activeElement.matches(':focus-visible')`)){keyboardInput=true;break;}
   }
   if(!keyboardInput||!win.isFocused())throw new Error('Native keyboard focus not attained');
   const result=await evaluate(`(async()=>{
    const appearance=${JSON.stringify(appearance)},deadline=Date.now()+15000;
    while(Date.now()<deadline&&(!document.querySelector('.theme-indicator')?.textContent?.includes(appearance)||window.matchMedia('(prefers-color-scheme: dark)').matches!==(appearance==='dark')))await new Promise(r=>setTimeout(r,50));
    await new Promise(r=>setTimeout(r,250));
    const root=document.documentElement,viewport=root.clientWidth;
    const controls=[...document.querySelectorAll('button,input,textarea')].filter(e=>e.getClientRects().length);
    const overflow=root.scrollWidth>viewport+1||document.body.scrollWidth>viewport+1||controls.some(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>viewport+1;});
    const labels=controls.filter(e=>e.matches('input,textarea')).every(e=>!!e.labels?.length);
    const ratio=(${contrastForPaint.toString()});
    const layers=(el)=>{const paints=[];for(let n=el;n;n=n.parentElement){const style=getComputedStyle(n);if(style.backgroundImage!=='none')throw new Error('Unexpected background image');paints.unshift(style.backgroundColor);}return paints;};
    let textChecks=0,minTextRatio=21,minLargeRatio=21,worstTag='',worstClass='';
    for(const el of document.querySelectorAll('body *')){
     if(!el.getClientRects().length||el.matches(':disabled')||el.closest('[hidden]'))continue;
     if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!el.matches('input,textarea'))continue;
     const style=getComputedStyle(el);if(style.visibility!=='visible')continue;
     const r=ratio(style.color,layers(el));const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
     if(large)minLargeRatio=Math.min(minLargeRatio,r);else if(r<minTextRatio){minTextRatio=r;worstTag=el.tagName;worstClass=typeof el.className==='string'?el.className.slice(0,100):'';}textChecks++;
    }
    const focus=document.activeElement;if(!focus?.matches('input:not(:disabled),textarea:not(:disabled)'))throw new Error('Native keyboard input focus not attained');
    const f=getComputedStyle(focus);const focusRatio=ratio(f.outlineColor,layers(focus.parentElement));
    const focusVisible=focus.matches(':focus-visible')&&f.outlineStyle!=='none'&&parseFloat(f.outlineWidth)>=2&&focusRatio>=3;
    focus.blur();window.scrollTo(0,0);await new Promise(r=>setTimeout(r,100));
    if(textChecks<20||minTextRatio<4.5||minLargeRatio<3||!focusVisible)return {syntheticFailureStage:'contrast',textChecks,minTextRatio,minLargeRatio,focusRatio,focusVisible,worstTag,worstClass};
    if(overflow||!labels||!document.querySelector('.theme-indicator')?.textContent?.includes(appearance)||window.matchMedia('(prefers-color-scheme: dark)').matches!==(appearance==='dark'))throw new Error('Cockpit layout or theme check failed');
    return {appearance,viewportWidth:viewport,viewportHeight:root.clientHeight,overflow:false,labels:true,textChecks,minTextRatio,minLargeRatio,focusRatio,focusVisible};
   })()`);
   if((result as {syntheticFailureStage?:string})?.syntheticFailureStage==='contrast'){const d=result as {textChecks:number;minTextRatio:number;minLargeRatio:number;focusRatio:number;focusVisible:boolean;worstTag:string;worstClass:string};progress('contrast',{textChecks:d.textChecks,minTextRatio:d.minTextRatio,minLargeRatio:d.minLargeRatio,focusRatio:d.focusRatio,focusVisible:d.focusVisible,worstTag:/^[A-Z]+$/.test(d.worstTag)?d.worstTag:'UNKNOWN',worstClass:/^[a-zA-Z0-9 _-]{0,100}$/.test(d.worstClass)?d.worstClass:'UNKNOWN'});throw new Error('Synthetic contrast oracle failed');}
   progress('capture-'+width+'x'+height+'-'+appearance);
   const contentSize=win.getContentSize();progress('capture-viewport',{requested:[width,height],actual:contentSize,visible:win.isVisible(),focused:win.isFocused()});
   if(contentSize[0]!==width||contentSize[1]!==height)throw new Error('Requested native viewport not attained');
   progress('capture-page');const image=await win.capturePage();const empty=image.isEmpty();
   const bytes=image.toPNG(),size=image.getSize();progress('capture-png',{imageSize:[size.width,size.height],bytes:bytes.length,empty});
   if(empty||bytes.length<1024||bytes.length>10*1024*1024||size.width<1||size.height<1)throw new Error('Native screenshot invalid');
   const name='cockpit-'+width+'x'+height+'-'+appearance+'.png';progress('capture-write');capture(name,bytes);
   layouts.push({requestedWidth:width,requestedHeight:height,contentSize,zoomFactor:win.webContents.getZoomFactor(),...(result as object),screenshot:{name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:size.width,height:size.height}});
  }
 }finally{theme.themeSource=originalTheme;win.webContents.setZoomFactor(originalZoom);win.setContentSize(originalSize[0],originalSize[1]);if(!originalVisible)win.hide();}
 progress('theme-persistence');
 const persisted=await evaluate(`(async()=>{const p=(await window.tmBridge.listProjectsDetailed()).find(x=>x.project_code==='COCKPIT-UI-001');return p?.status==='active'&&p?.billing_address==='3 UI Billing Road'&&p?.notes==='LONGSYNTHETIC'.repeat(45)?p.id:null;})()`);
 if(persisted!==(interaction as {projectId:string}).projectId)throw new Error('Theme changes affected project state');
 return {schema:'tm-cockpit-flow-v1',synthetic:true,interaction,layouts,themeStatePreserved:true,note:'Packaged DOM interaction, computed flat-paint WCAG-oriented ratios and native capture under synthetic appearance override. Physical keyboard, screen reader, perceptual contrast and actual OS-theme witness remain open.'};
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

/** Real development renderer CSS hot-update proof; runner changes only an ignored synthetic fixture. */
export async function runDevelopmentHmrFlow(win:SecurityWindow,nonce:string,ready:(before:unknown)=>void){
 if(!/^[a-f0-9]{32}$/.test(nonce))throw new Error('Invalid development proof nonce');
 const expectedCsp=SECURITY_CSP.replace("style-src 'self'","style-src 'self' 'unsafe-inline'").replace("connect-src 'none'","connect-src 'self' ws://localhost:* ws://127.0.0.1:*");
 const url=new URL(win.webContents.getURL());
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Development proof requires loopback HTTP');
 const before=await win.webContents.executeJavaScript(`(async()=>{
  const expected=${JSON.stringify('initial-'+nonce)},marker=${JSON.stringify(nonce)},deadline=Date.now()+20000;
  const css=()=>getComputedStyle(document.documentElement).getPropertyValue('--tm-hmr-proof').trim();
  while(Date.now()<deadline&&(!document.querySelector('.intro-row h1')||css()!==expected))await new Promise(r=>setTimeout(r,50));
  const health=await window.tmBridge.ping();
  document.documentElement.dataset.tmHmrDocumentMarker=marker;
  return {value:css(),title:document.querySelector('.intro-row h1')?.textContent,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,health:health.status==='ok'&&health.foundation===true,requireAbsent:typeof require==='undefined',processAbsent:typeof process==='undefined',marker:document.documentElement.dataset.tmHmrDocumentMarker};
 })()`);
 const b=before as {value?:string;title?:string;csp?:string;health?:boolean;requireAbsent?:boolean;processAbsent?:boolean;marker?:string};
 if(b.value!=='initial-'+nonce||b.title!=='Local foundation cockpit'||b.csp!==expectedCsp||b.health!==true||b.requireAbsent!==true||b.processAbsent!==true||b.marker!==nonce)throw new Error('Development proof initial observations invalid');
 ready(before);
 const after=await win.webContents.executeJavaScript(`(async()=>{
  const expected=${JSON.stringify('updated-'+nonce)},marker=${JSON.stringify(nonce)},deadline=Date.now()+30000;
  const css=()=>getComputedStyle(document.documentElement).getPropertyValue('--tm-hmr-proof').trim();
  while(Date.now()<deadline&&css()!==expected)await new Promise(r=>setTimeout(r,50));
  const health=await window.tmBridge.ping();
  return {value:css(),title:document.querySelector('.intro-row h1')?.textContent,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,health:health.status==='ok'&&health.foundation===true,requireAbsent:typeof require==='undefined',processAbsent:typeof process==='undefined',marker:document.documentElement.dataset.tmHmrDocumentMarker===marker?marker:null};
 })()`);
 const a=after as typeof b;
 if(a.value!=='updated-'+nonce||a.title!==b.title||a.csp!==expectedCsp||a.health!==true||a.requireAbsent!==true||a.processAbsent!==true||a.marker!==nonce||win.webContents.getURL()!==url.href)throw new Error('Development proof hot-update observations invalid');
 return {schema:'tm-dev-hmr-v1',synthetic:true,nonce,before,after,documentPreserved:true,loopbackOrigin:true};
}

/** Read every synthetic table and all managed evidence roots, not diagnostics or Chromium caches. */
export function captureRawProofState(db:DatabaseSync,profile:string):string{
 const rows:Record<string,unknown>={};
 for(const table of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
  const name=table.name;if(typeof name!=='string'||!/^[a-z][a-z0-9_]*$/.test(name))throw new Error('Unexpected synthetic schema identifier');
  rows[name]=db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all();
 }
 const files:Array<[string,string]>=[];
 const visit=(relative:string)=>{
  const file=path.join(profile,relative);let stat:fs.Stats;
  try{stat=fs.lstatSync(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  if(stat.isSymbolicLink())throw new Error('Unexpected synthetic proof alias');
  if(stat.isDirectory()){files.push([relative,'directory']);for(const name of fs.readdirSync(file).sort())visit(path.join(relative,name));}
  else if(stat.isFile())files.push([relative,hashSyntheticCensusFile(file,stat)]);
  else throw new Error('Unexpected synthetic proof file');
 };
 for(const root of ['local-data/vault','local-data/artifacts','local-data/migration-rescues','settings','secrets'])visit(root);
 return JSON.stringify({rows,files});
}
export const RAW_PROOF_URL='tmapp://app/raw-ipc-proof.html';
export const RAW_DENIED_URL='tmapp://app/raw-denied.html';
export const RAW_FRAME_URLS=Object.freeze(['tmapp://app/raw-frame.html','tmapp://raw-fixture/raw-frame.html']);
export const RAW_TRUSTED_CASES=Object.freeze([
 ['valid-ping','OK'],['replayed-ping','SECURITY'],['wrong-version','VALIDATION'],['bad-envelope','VALIDATION'],['missing-argument','VALIDATION'],['extra-argument','VALIDATION'],['oversized','VALIDATION'],['cyclic','VALIDATION'],['invalid-mutation','VALIDATION'],['replayed-altered-mutation','SECURITY'],['unknown-channel','UNREGISTERED']
] as const);
/** Synthetic page, separate from production HTML. No remote origin, script or network resource. */
export function rawProofPage(url:string):string|null{
 if(url===RAW_PROOF_URL)return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; frame-src tmapp://app tmapp://raw-fixture; base-uri \'none\'; form-action \'none\'"></head><body><iframe src="'+RAW_FRAME_URLS[0]+'"></iframe><iframe src="'+RAW_FRAME_URLS[1]+'"></iframe></body></html>';
 if(url===RAW_DENIED_URL||RAW_FRAME_URLS.includes(url))return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; form-action \'none\'"></head><body>Synthetic IPC frame</body></html>';
 return null;
}
/** A fixed preload program, generated only for the disposable raw proof. No contextBridge or
 * input listener: no callable transport is installed in either the main or isolated page world. */
export function rawProofPreload(projectId:string):string{
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId))throw new Error('Unexpected synthetic project identity');
 const channels=JSON.stringify(ALL_CHANNELS),map=JSON.stringify(CHANNELS),id=JSON.stringify(projectId);
 return `const {ipcRenderer}=require('electron');
 const channels=${channels},c=${map},projectId=${id};
 const mainUrl=${JSON.stringify(RAW_PROOF_URL)},deniedUrl=${JSON.stringify(RAW_DENIED_URL)},frames=${JSON.stringify(RAW_FRAME_URLS)};
 const project={code:'RAW-DENIED',customer:'Synthetic denied',siteAddress:'Synthetic site'};
 const profile={legalName:'Synthetic denied',tradeName:'',phone:'',email:'',mailingAddress:'',taxId:'',contractorLicense:''};
 const payloads={[c.projectAdd]:project,[c.projectEdit]:{id:projectId,...project},[c.projectDetails]:{id:projectId,name:'Denied',billingAddress:'Denied',notes:'Denied'},[c.projectStatus]:{id:projectId,status:'archived'},[c.businessUpdate]:profile,[c.fakeSecretStore]:'TEST-FAKE-EXAMPLE'};
 const make=(payload=null)=>({requestId:crypto.randomUUID(),version:1,payload});
 const observe=async(name,channel,args)=>{
  const id=args[0]?.requestId;
  try{
   const result=await ipcRenderer.invoke(channel,...args);
   const correlated=typeof result?.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result.requestId)&&(!id||id===result.requestId);
   if(result?.ok===true)return {name,code:'OK',correlated,health:result.data?.status==='ok'&&result.data?.foundation===true};
   return {name,code:result?.ok===false&&result.error?.correlationId===result.requestId?result.error.code:'INVALID_RESPONSE',correlated};
  }catch(error){return {name,code:channel==='tm.proof.unregistered'&&/No handler registered/.test(String(error))?'UNREGISTERED':'TRANSPORT_ERROR',correlated:false};}
 };
 window.addEventListener('DOMContentLoaded',async()=>{
  const url=location.href,main=process.isMainFrame===true,results=[];
  if(url===mainUrl&&main){
   const ping=make(),invalid=make(null),cyclic={};cyclic.self=cyclic;
   results.push(await observe('valid-ping',c.ping,[ping]));
   results.push(await observe('replayed-ping',c.ping,[ping]));
   results.push(await observe('wrong-version',c.projectAdd,[{...make(project),version:2}]));
   results.push(await observe('bad-envelope',c.projectAdd,[{...make(project),extra:true}]));
   results.push(await observe('missing-argument',c.projectAdd,[]));
   results.push(await observe('extra-argument',c.projectAdd,[make(project),'extra']));
   results.push(await observe('oversized',c.projectAdd,[make({...project,customer:'x'.repeat(18000)})]));
   results.push(await observe('cyclic',c.projectAdd,[make(cyclic)]));
   results.push(await observe('invalid-mutation',c.projectAdd,[invalid]));
   results.push(await observe('replayed-altered-mutation',c.projectAdd,[{...invalid,payload:project}]));
   results.push(await observe('unknown-channel','tm.proof.unregistered',[make(project)]));
  }else if((frames.includes(url)&&!main)||(url===deniedUrl&&main)){
   for(const channel of channels)results.push(await observe(channel,channel,[make(payloads[channel]??null)]));
  }else return;
  document.documentElement.setAttribute('data-tm-raw-receipt',JSON.stringify({url,main,results}));
 },{once:true});`;
}
interface RawProofFrame{url:string;frames:RawProofFrame[];executeJavaScript(code:string):Promise<unknown>}
interface RawProofWindow{webContents:{mainFrame:RawProofFrame};loadURL(url:string):Promise<void>}
/** Actual frame objects come from Electron; renderer receipt alone cannot identify a subframe. */
export async function collectRawIpcProof(win:RawProofWindow,snapshot:()=>string,baseline:string){
 const read=async(frame:RawProofFrame,expectedUrl:string)=>{
  if(frame.url!==expectedUrl)throw new Error('Native raw proof frame URL mismatch');
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
   const text=await frame.executeJavaScript("document.documentElement.getAttribute('data-tm-raw-receipt')");
   if(typeof text==='string')return JSON.parse(text) as unknown;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('Native raw proof frame did not return receipt');
 };
 const top=win.webContents.mainFrame,trusted=await read(top,RAW_PROOF_URL);
 const children=[];
 for(const url of RAW_FRAME_URLS){const matches=top.frames.filter(f=>f.url===url);if(matches.length!==1)throw new Error('Missing unique native IPC subframe');children.push(await read(matches[0],url));}
 const firstUnchanged=snapshot()===baseline;
 await win.loadURL(RAW_DENIED_URL);
 const wrongTop=await read(win.webContents.mainFrame,RAW_DENIED_URL);
 return {schema:'tm-native-raw-ipc-v1',synthetic:true,source:'packaged-binary',trusted,children,wrongTop,stateUnchanged:firstUnchanged&&snapshot()===baseline};
}
