/** Only selected managed metadata crosses IPC; no raw paths or file bytes supplied by renderer. */
export type BusinessLogoStatus={id:string;mime:'image/png'|'image/jpeg';sha256:string};
export type ManagedBusinessLogo=BusinessLogoStatus&{relativePath:string};
/** Metadata only from the OS-selected backup folder; never accepts renderer paths. */
export type BackupListEntry=
 | {id:string;status:'verified';createdUtc:string;fileCount:number;manifestIdentity:string}
 | {id:string;status:'rejected'};
export type BackupListResult={backups:BackupListEntry[]};
export type BackupManifest={schema:'tm-phase1-backup-v1';createdUtc:string;files:Array<{path:string;bytes:number;sha256:string}>;excluded:string[]};
