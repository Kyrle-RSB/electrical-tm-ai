/** Appearance follows the operating system unless the person picks Light or Dark in
 * Settings. The choice is a per-computer display preference kept in renderer storage;
 * it is not business data, so it is not in the database or in backups. */
export type Appearance='light'|'dark';
export type AppearancePreference='system'|Appearance;
export const APPEARANCE_STORAGE_KEY='tm.appearance';
export const appearancePreferences:readonly AppearancePreference[]=['system','light','dark'];

export function getSystemAppearance():Appearance{
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export function subscribeToSystemAppearance(listener:(appearance:Appearance)=>void):()=>void{
 const query=window.matchMedia?.('(prefers-color-scheme: dark)');
 if(!query)return()=>{};
 const changed=()=>listener(query.matches?'dark':'light');
 query.addEventListener('change',changed);
 return()=>query.removeEventListener('change',changed);
}

/** Anything unknown, including a missing or damaged stored value, means "system". */
export function parseAppearancePreference(raw:unknown):AppearancePreference{
 return raw==='light'||raw==='dark'?raw:'system';
}
export function resolveAppearance(preference:AppearancePreference,system:Appearance):Appearance{
 return preference==='system'?system:preference;
}

type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
function defaultStorage():StorageLike|null{try{return window.localStorage;}catch{return null;}}
export function readAppearancePreference(storage:StorageLike|null=defaultStorage()):AppearancePreference{
 try{return parseAppearancePreference(storage?.getItem(APPEARANCE_STORAGE_KEY));}catch{return 'system';}
}
export function writeAppearancePreference(preference:AppearancePreference,storage:StorageLike|null=defaultStorage()):void{
 try{
  if(preference==='system')storage?.removeItem(APPEARANCE_STORAGE_KEY);
  else storage?.setItem(APPEARANCE_STORAGE_KEY,preference);
 }catch{/* Storage can be unavailable; the choice then lasts for this session only. */}
}
export function applyAppearance(appearance:Appearance,root:HTMLElement=document.documentElement):void{
 root.dataset.theme=appearance;
}
