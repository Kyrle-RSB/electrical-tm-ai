import fs from 'node:fs';
import path from 'node:path';
/** The OS application-data directory may be platform-resolved. Never follow a redirected app-owned child. */
export function ensureOwnedDirectory(directory:string,create=true):void{
 if(create)fs.mkdirSync(directory,{recursive:true,mode:0o700});
 try{const stat=fs.lstatSync(directory);if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('Unsafe application data directory');}
 catch(error){if(!create&&(error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
}
function verifyOptionalFile(file:string):void{
 try{const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.nlink!==1)throw new Error('Unsafe application data file');}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
}
/** Resolve one stable isolated data root; do not relocate an existing profile or write into packaged resources. */
export function prepareApplicationPaths(profile:string,appPath:string,resourcesPath:string,packaged:boolean){
 if(!path.isAbsolute(profile)||!path.isAbsolute(appPath))throw new Error('Application paths must be absolute');
 const dataRoot=path.join(profile,'local-data'),dbDir=path.join(dataRoot,'db'),database=path.join(dbDir,'app.sqlite');
 const owned=[profile,dataRoot,dbDir,path.join(dataRoot,'vault'),path.join(dataRoot,'vault','images'),path.join(dataRoot,'artifacts'),path.join(dataRoot,'artifacts','issued'),path.join(dataRoot,'migration-rescues'),path.join(profile,'secrets'),path.join(profile,'settings'),path.join(profile,'diagnostics')];
 // Check ancestors in ownership order before any child write.
 for(const directory of owned)ensureOwnedDirectory(directory,false);
 ensureOwnedDirectory(profile);ensureOwnedDirectory(dataRoot);ensureOwnedDirectory(dbDir);
 const settings=path.join(profile,'settings','backup-location.json'),secret=path.join(profile,'secrets','phase1-fake.bin');
 for(const file of [database,database+'-wal',database+'-shm',database+'-journal',settings,secret,path.join(profile,'diagnostics','startup.jsonl')])verifyOptionalFile(file);
 const migrations=packaged?path.join(resourcesPath,'migrations'):path.resolve(appPath,'../../packages/persistence-sqlite/src/migrations');
 return Object.freeze({profile,dataRoot,database,migrations,settings,secret});
}
