import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
test('upgrading a populated old schema creates a verified rescue copy and preserves records',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-upgrade-'));
 const fresh=path.join(root,'original'),full='packages/persistence-sqlite/src/migrations';
 const dbPath=path.join(root,'local-data','db','app.sqlite');fs.mkdirSync(fresh);
 try {
  fs.copyFileSync(path.join(full,'0001-initial.sql'),path.join(fresh,'0001-initial.sql'));
  const v1=new LocalStore(dbPath,fresh);v1.initializeFictionalCompany();
  const id=v1.createProject({code:'OLD-01',customer:'Fictional',siteAddress:'100 Old Street'});v1.close();
  const upgraded=new LocalStore(dbPath,full);assert.equal(upgraded.listProjects()[0].id,id);
  assert.ok(upgraded.lastMigrationRescuePath);assert.ok(fs.existsSync(upgraded.lastMigrationRescuePath!));
  const rescue=new DatabaseSync(upgraded.lastMigrationRescuePath!,{readOnly:true});
  try {assert.equal((rescue.prepare('SELECT count(*) AS n FROM projects').get() as any).n,1);
       assert.equal((rescue.prepare('SELECT count(*) AS n FROM schema_migrations').get() as any).n,1);}
  finally{rescue.close();}upgraded.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('a failed new migration rolls back and keeps both original DB and rescue',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-upgrade-fail-'));
 const old=path.join(root,'old'),broken=path.join(root,'broken'),file=path.join(root,'data','db','app.sqlite');
 const full='packages/persistence-sqlite/src/migrations';fs.mkdirSync(old);fs.mkdirSync(broken);
 try{
  const v1=path.join(full,'0001-initial.sql');for(const dir of [old,broken])fs.copyFileSync(v1,path.join(dir,'0001-initial.sql'));
  fs.writeFileSync(path.join(broken,'0002-bad.sql'),'CREATE TABLE failure_probe(x INTEGER);\nTHIS IS INVALID;');
  let db=new LocalStore(file,old);db.initializeFictionalCompany();db.createProject({code:'BEFORE',customer:'Fictional',siteAddress:'Stable'});db.close();
  assert.throws(()=>new LocalStore(file,broken),/syntax error|near/);
  db=new LocalStore(file,old);assert.equal(db.listProjects()[0].project_code,'BEFORE');
  assert.equal((db.db.prepare('SELECT count(*) AS n FROM schema_migrations').get() as any).n,1);
  assert.equal(db.db.prepare("SELECT name FROM sqlite_master WHERE name='failure_probe'").get(),undefined);
  db.close();
  const rescues=fs.readdirSync(path.join(root,'data','migration-rescues'));
  assert.equal(rescues.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('interrupted SQLite schema transaction is rolled back on process restart',()=>{
 const {spawnSync}=require('node:child_process') as typeof import('node:child_process');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-migration-crash-'));
 const old=path.join(root,'old'),file=path.join(root,'data','db','app.sqlite');
 const full='packages/persistence-sqlite/src/migrations';fs.mkdirSync(old);
 try{
  fs.copyFileSync(path.join(full,'0001-initial.sql'),path.join(old,'0001-initial.sql'));
  let db=new LocalStore(file,old);db.initializeFictionalCompany();
  const id=db.createProject({code:'CRASH-BEFORE',customer:'Fictional',siteAddress:'Stable'});db.close();
  const interrupted=spawnSync(process.execPath,['-e',`const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec('BEGIN IMMEDIATE; CREATE TABLE interrupted_probe(x INTEGER);');process.exit(77);`,file],{encoding:'utf8',windowsHide:true});
  assert.equal(interrupted.status,77,interrupted.stderr);
  db=new LocalStore(file,full);
  try{
   assert.equal(db.listProjects()[0].id,id);
   assert.equal(db.db.prepare("SELECT name FROM sqlite_master WHERE name='interrupted_probe'").get(),undefined);
   assert.equal((db.db.prepare('PRAGMA quick_check').get() as any).quick_check,'ok');
   assert.deepEqual(db.db.prepare('PRAGMA foreign_key_check').all(),[]);
   assert.deepEqual(db.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r:any)=>r.version),[1,2,3,4,5,6,7]);
  }finally{db.close();}
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('legacy Windows migration checksums survive a portable LF checkout without rewriting history',()=>{
 const {createHash}=require('node:crypto') as typeof import('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-migration-eol-'));
 const old=path.join(root,'old'),lf=path.join(root,'lf'),file=path.join(root,'data','db','app.sqlite');
 const full='packages/persistence-sqlite/src/migrations';fs.mkdirSync(old);fs.mkdirSync(lf);
 try{
  for(const name of fs.readdirSync(full).filter(n=>n.endsWith('.sql'))){
   const canonical=fs.readFileSync(path.join(full,name),'utf8').replace(/\r\n/g,'\n');
   fs.writeFileSync(path.join(lf,name),canonical);
   if(name==='0001-initial.sql')fs.writeFileSync(path.join(old,name),canonical.replace(/\n/g,'\r\n'));
  }
  const legacyHash=createHash('sha256').update(fs.readFileSync(path.join(old,'0001-initial.sql'))).digest('hex');
  // Simulate a historical Windows build that hashed the CRLF bytes before normalization existed.
  const v1=new LocalStore(file,old);v1.initializeFictionalCompany();
  const id=v1.createProject({code:'EOL-01',customer:'Fictional',siteAddress:'Stable'});
  v1.db.prepare('UPDATE schema_migrations SET checksum=? WHERE version=1').run(legacyHash);v1.close();
  let reopened=new LocalStore(file,lf);
  try{assert.equal(reopened.listProjects()[0].id,id);assert.equal(reopened.db.prepare('SELECT checksum FROM schema_migrations WHERE version=1').get()?.checksum,legacyHash);assert.ok(reopened.lastMigrationRescuePath);}finally{reopened.close();}
  // Same line endings are not a reason to accept changed SQL or history.
  fs.appendFileSync(path.join(lf,'0001-initial.sql'),'\n-- non-identical migration content\n');
  assert.throws(()=>new LocalStore(file,lf),/Migration history mismatch/);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
