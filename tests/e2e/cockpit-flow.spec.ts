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
