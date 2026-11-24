/** Only selected managed metadata crosses IPC; no raw paths or file bytes supplied by renderer. */
export type BusinessLogoStatus={id:string;mime:'image/png'|'image/jpeg';sha256:string};
export type ManagedBusinessLogo=BusinessLogoStatus&{relativePath:string};
