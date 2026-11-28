import {useEffect,useState} from 'react';
import type {BackupListEntry} from '../../../../../../packages/contracts/src/ipc/settings.contract';
/** A backup is not a proof of recovery until the separate restore test passes. */
export function BackupLocation({track}:{track:<T>(action:()=>Promise<T>)=>Promise<T>}){
 const [folder,setFolder]=useState<string|null>(null);
 const [status,setStatus]=useState('Checking backup location...');
 const [busy,setBusy]=useState(false);
 const [backups,setBackups]=useState<BackupListEntry[]|null>(null);
 useEffect(()=>{let active=true;window.tmBridge.getBackupFolder().then(v=>{
   if(active){setFolder(v.folder);setStatus(v.folder?'Backup location selected.':'Choose a backup folder before creating a backup.');}
 }).catch(err=>{if(active)setStatus('Backup setting unavailable: '+String(err));});return()=>{active=false};},[]);
 const perform=async(type:'choose'|'create'|'list')=>{
  setBusy(true);setBackups(null);setStatus('Working...');try{
   if(type==='list'){const r=await track(()=>window.tmBridge.listVerifiedBackups());setBackups(r.backups);setStatus(r.backups.length?'Backup verification finished. Review results below.':'No completed application backups found.');return;}
   const response=type==='choose'?await track(()=>window.tmBridge.chooseBackupFolder()):await track(()=>window.tmBridge.backUpToSelectedFolder());
   if(response===null){setStatus('Cancelled. No backup changes made.');return;}
   if(type==='choose'){
    const r=response as {folder:string};setFolder(r.folder);setStatus('Backup folder saved locally.');
   }else{
    const r=response as {backupPath:string};setStatus('Backup created: '+r.backupPath);
   }
  }catch(error){setStatus('Backup operation failed: '+String(error));}
  finally{setBusy(false);}
 };
 return <section className="glass" aria-labelledby="backup-title">
  <h2 id="backup-title">Backup and recovery</h2>
  <p>Keep backups on a separate drive or folder. A successful backup needs a verified restore before relying on it.</p>
  <p className="path-text">{folder||'No folder configured'}</p>
  <div className="actions"><button disabled={busy} onClick={()=>perform('choose')}>Choose backup folder</button>
   <button disabled={busy||!folder} onClick={()=>perform('create')}>Back up now</button>
   <button disabled={busy||!folder} onClick={()=>perform('list')}>Verify saved backups</button></div>
  {backups&&backups.length>0&&<ul aria-label="Saved backup verification results">{backups.map(b=><li key={b.id} className="path-text">{b.id}: {b.status==='verified'?`Verified at scan, ${b.fileCount} files (${b.createdUtc})`:'Rejected: do not rely on this archive'}</li>)}</ul>}
  <p role="status" aria-live="polite" className="project-status">{status}</p>
 </section>;
}
