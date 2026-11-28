import { DatabaseSync } from 'node:sqlite';
import type {BusinessLogoStatus,ManagedBusinessLogo} from '../../contracts/src/ipc/settings.contract';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectRepository, type ProjectState} from './repos/project-repo';
import {withImmediateTransaction} from './transactions/unit-of-work';
import type {ProjectInput,DetailedProject} from '../../contracts/src/ipc/projects.contract';
/** Shipped migrations remain append-only. New checksums use LF; accept exact historical CRLF equivalent without rewriting installed receipts. */
function loadMigrations(dir:string):Array<{version:number;sql:string;checksum:string;legacyWindowsChecksum:string}> {
  const files=fs.readdirSync(dir).filter(file=>/^\d{4}-[a-z0-9-]+\.sql$/.test(file)).sort();
  if(!files.length)throw new Error('No database migrations were bundled');
  return files.map((file,index)=>{
    const version=Number(file.slice(0,4));
    if(version!==index+1)throw new Error('Database migration sequence contains gaps or duplicate versions');
    const sql=fs.readFileSync(path.join(dir,file),'utf8').replace(/\r\n/g,'\n');
    const digest=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
    return {version,sql,checksum:digest(sql),legacyWindowsChecksum:digest(sql.replace(/\n/g,'\r\n'))};
  });
}

export class LocalStore {
  readonly db: DatabaseSync;
  readonly projects:ProjectRepository;
  lastMigrationRescuePath:string|null=null;
  constructor(public readonly dbPath: string,private readonly migrationsDir=path.join(process.cwd(),'packages','persistence-sqlite','src','migrations')) {
    fs.mkdirSync(path.dirname(dbPath), {recursive:true,mode:0o700});
    this.db=new DatabaseSync(dbPath, {timeout:5000});
    this.projects=new ProjectRepository(this.db);
    try {
      this.db.exec('PRAGMA foreign_keys=ON');
      // REPLACE implicitly deletes conflicting rows; immutable delete triggers must run.
      this.db.exec('PRAGMA recursive_triggers=ON');
      this.db.exec('PRAGMA journal_mode=WAL');
      this.db.exec('PRAGMA busy_timeout=5000');
      this.migrate();
    }catch(error){this.db.close();throw error;}
  }
  private migrate() {
    const migrations=loadMigrations(this.migrationsDir);
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, installed_utc TEXT NOT NULL) STRICT;');
    const installed=this.db.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all() as Array<{version:number;checksum:string}>;
    if(installed.some((x,index)=>x.version!==index+1||!migrations.find(m=>m.version===x.version&&(m.checksum===x.checksum||m.legacyWindowsChecksum===x.checksum))))
      throw new Error('Migration history mismatch: unknown or altered migration');
    const pending=migrations.filter(m=>!installed.some(x=>x.version===m.version));
    // Existing nonempty schemas get a crash-consistent rescue before any upgrade.
    // VACUUM INTO uses SQLite itself, never raw copying of a live WAL file.
    if(installed.length&&pending.length){
      const rescueDir=path.join(path.dirname(path.dirname(this.dbPath)),'migration-rescues');
      fs.mkdirSync(rescueDir,{recursive:true,mode:0o700});
      const rescue=path.join(rescueDir,`pre-migration-${installed.at(-1)!.version}-${crypto.randomUUID()}.sqlite`);
      this.db.prepare('VACUUM INTO ?').run(rescue);
      const rescueDb=new DatabaseSync(rescue,{readOnly:true});
      try{
        const integrity=rescueDb.prepare('PRAGMA quick_check').get() as {quick_check:string};
        if(integrity.quick_check!=='ok')throw new Error('Migration rescue integrity failed');
      }finally{rescueDb.close();}
      this.lastMigrationRescuePath=rescue;
    }
    for(const migration of migrations){
      if(installed.some(x=>x.version===migration.version))continue;
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(migration.sql);
        this.db.prepare('INSERT INTO schema_migrations(version,checksum,installed_utc) VALUES(?,?,?)')
          .run(migration.version,migration.checksum,new Date().toISOString());
        this.db.exec('COMMIT');
      } catch(e){this.db.exec('ROLLBACK');throw e;}
    }
    const integrity=this.db.prepare('PRAGMA quick_check').get() as {quick_check:string};
    if(integrity.quick_check!=='ok'||this.db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('SQLite integrity or foreign key verification failed');
  }
  initializeFictionalCompany():void {
    this.db.prepare('INSERT OR IGNORE INTO business_profiles(id,legal_name) VALUES (?,?)').run('local','Synthetic Demo Electric Ltd.');
  }
  createProject(input:ProjectInput):string{
    return this.projects.create(input);
  }
  updateProject(id:string,input:ProjectInput):void{
    this.projects.edit(id,input);
  }
  listProjects():Array<{id:string;project_code:string;customer_name:string;site_address:string}>{
    return this.projects.list();
  }
  isFirstRunComplete():boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM business_settings WHERE business_id='local'").get());
  }
  getBusinessProfile():{
    legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;currency:string;taxId:string;contractorLicense:string
  } {
    const r=this.db.prepare(`SELECT b.legal_name AS legalName,COALESCE(s.trade_name,'') AS tradeName,
      COALESCE(s.phone,'') AS phone,COALESCE(s.email,'') AS email,
      COALESCE(s.mailing_address,'') AS mailingAddress,COALESCE(s.currency,'CAD') AS currency,
      COALESCE(s.tax_identifier,'') AS taxId,COALESCE(s.electrical_license_id,'') AS contractorLicense
      FROM business_profiles b LEFT JOIN business_settings s ON s.business_id=b.id WHERE b.id='local'`).get();
    if(!r)throw new Error('Local business profile not initialized');
    return r as ReturnType<LocalStore['getBusinessProfile']>;
  }
  updateBusinessProfile(input:{legalName:string;tradeName:string;phone:string;email:string;mailingAddress:string;taxId:string;contractorLicense:string}):void{
    withImmediateTransaction(this.db,()=>{
      this.db.prepare('UPDATE business_profiles SET legal_name=? WHERE id=?').run(input.legalName,'local');
      this.db.prepare(`INSERT INTO business_settings (business_id,trade_name,phone,email,mailing_address,currency,tax_identifier,electrical_license_id,updated_utc)
        VALUES ('local',?,?,?,?,'CAD',?,?,?) ON CONFLICT(business_id) DO UPDATE SET
        trade_name=excluded.trade_name,phone=excluded.phone,email=excluded.email,mailing_address=excluded.mailing_address,
        tax_identifier=excluded.tax_identifier,electrical_license_id=excluded.electrical_license_id,updated_utc=excluded.updated_utc`)
        .run(input.tradeName,input.phone,input.email,input.mailingAddress,input.taxId,input.contractorLicense,new Date().toISOString());
      this.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('business.update','local',new Date().toISOString());
    });
  }
  getBusinessLogo():BusinessLogoStatus|null {
    return (this.db.prepare("SELECT asset_id AS id,mime,sha256 FROM business_logo_assets WHERE business_id='local'").get() as BusinessLogoStatus|undefined)??null;
  }
  setBusinessLogo(asset:ManagedBusinessLogo):void {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(asset.id)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!['image/png','image/jpeg'].includes(asset.mime)||asset.relativePath!==`images/${asset.id}.${asset.mime==='image/png'?'png':'jpg'}`)throw new Error('Invalid managed logo reference');
    withImmediateTransaction(this.db,()=>{
      this.db.prepare(`INSERT INTO business_logo_assets(business_id,asset_id,vault_locator,sha256,mime,updated_utc) VALUES('local',?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET asset_id=excluded.asset_id,vault_locator=excluded.vault_locator,sha256=excluded.sha256,mime=excluded.mime,updated_utc=excluded.updated_utc`).run(asset.id,asset.relativePath,asset.sha256,asset.mime,new Date().toISOString());
      this.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('business.logo.set','local',new Date().toISOString());
    });
  }
  removeBusinessLogo():void {
    withImmediateTransaction(this.db,()=>{
      this.db.prepare("DELETE FROM business_logo_assets WHERE business_id='local'").run();
      this.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('business.logo.remove','local',new Date().toISOString());
    });
    // Keep historical managed bytes: do not delete possible evidence used by future immutable document snapshots.
  }
  updateProjectDetails(id:string,details:{name:string;billingAddress:string;notes:string}):void{
    this.projects.details(id,details);
  }
  setProjectStatus(id:string,status:ProjectState,reason?:string):void{
    this.projects.status(id,status,reason);
  }
  listProjectsDetailed():DetailedProject[]{
    return this.projects.listDetailed();
  }
  getProject(id:string):DetailedProject|null{
    return this.projects.get(id);
  }
  /** Durable rejection of successful database mutation IDs within this database history. */
  mutateOnce<T>(operationId:string,channel:string,action:()=>T):T{
    const id=operationId.toLowerCase();
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw new Error('Invalid mutation operation ID');
    return withImmediateTransaction(this.db,()=>{
      if(this.db.prepare('SELECT 1 FROM operation_receipts WHERE operation_id=?').get(id))throw new Error('SECURITY: duplicate mutation operation ID');
      const result=action();
      this.db.prepare('INSERT INTO operation_receipts(operation_id,channel,completed_utc) VALUES(?,?,?)').run(id,channel,new Date().toISOString());
      return result;
    });
  }
  close():void{this.db.close();}
}
