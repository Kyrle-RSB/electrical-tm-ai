import crypto from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {withImmediateTransaction} from '../transactions/unit-of-work';
/** Local authoritative project records. Archive rather than delete linked financial evidence. */
export type ProjectData={id:string;project_code:string;customer_name:string;site_address:string};
export type DetailedProject=ProjectData&{status:string;project_name:string;billing_address:string;notes:string};
export type ProjectState='planned'|'active'|'on-hold'|'complete'|'closed'|'archived';
export class ProjectRepository {
 constructor(private readonly db:DatabaseSync){}
 create(input:{code:string;customer:string;siteAddress:string}):string{
  const id=crypto.randomUUID(),now=new Date().toISOString();
  return withImmediateTransaction(this.db,()=>{
   this.db.prepare('INSERT INTO projects(id,business_id,project_code,customer_name,site_address,opened_utc) VALUES(?,?,?,?,?,?)')
     .run(id,'local',input.code,input.customer,input.siteAddress,now);
   this.audit('project.create',id);
   return id;
  });
 }
 edit(id:string,input:{code:string;customer:string;siteAddress:string}):void {
  withImmediateTransaction(this.db,()=>{
   const changed=this.db.prepare('UPDATE projects SET project_code=?,customer_name=?,site_address=? WHERE id=?')
     .run(input.code,input.customer,input.siteAddress,id);
   if(!changed.changes)throw new Error('Project not found');
   this.audit('project.edit',id);
  });
 }
 list():ProjectData[]{
  return this.db.prepare('SELECT id,project_code,customer_name,site_address FROM projects ORDER BY project_code').all() as ProjectData[];
 }
 details(id:string,value:{name:string;billingAddress:string;notes:string}):void{
  withImmediateTransaction(this.db,()=>{
   if(!this.db.prepare('SELECT id FROM projects WHERE id=?').get(id))throw new Error('Project not found');
   this.db.prepare(`INSERT INTO project_details(project_id,project_name,billing_address,notes,updated_utc)
     VALUES(?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET
     project_name=excluded.project_name,billing_address=excluded.billing_address,notes=excluded.notes,updated_utc=excluded.updated_utc`)
     .run(id,value.name,value.billingAddress,value.notes,new Date().toISOString());
   this.audit('project.update',id);
  });
 }
 status(id:string,status:ProjectState):void {
  withImmediateTransaction(this.db,()=>{
   if(!this.db.prepare('SELECT id FROM projects WHERE id=?').get(id))throw new Error('Project not found');
   this.db.prepare(`INSERT INTO project_details(project_id,status,updated_utc) VALUES(?,?,?)
     ON CONFLICT(project_id) DO UPDATE SET status=excluded.status,updated_utc=excluded.updated_utc`)
     .run(id,status,new Date().toISOString());
   this.audit('project.status.'+status,id);
  });
 }
 listDetailed():DetailedProject[]{
  return this.db.prepare(`SELECT p.id,p.project_code,p.customer_name,p.site_address,
      COALESCE(d.status,'active') AS status,COALESCE(d.project_name,'') AS project_name,
      COALESCE(d.billing_address,'') AS billing_address,COALESCE(d.notes,'') AS notes
      FROM projects p LEFT JOIN project_details d ON p.id=d.project_id ORDER BY p.project_code`).all() as DetailedProject[];
 }
 private audit(action:string,id:string):void {
  this.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)')
    .run(action,id,new Date().toISOString());
 }
}
