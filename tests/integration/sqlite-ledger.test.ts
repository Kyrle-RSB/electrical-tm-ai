import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {withImmediateTransaction} from '../../packages/persistence-sqlite/src/transactions/unit-of-work';
import {LocalStore} from '../../packages/persistence-sqlite/src/connection';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'tm-p2-sqlite-'));
test('historical migrations apply exactly once, business and project details survive restart',()=>{
 const dir=temp();try{
  const file=path.join(dir,'app.sqlite');let store=new LocalStore(file);store.initializeFictionalCompany();
  assert.deepEqual((store.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {version:number}[]).map(x=>x.version),[1,2,3,4,5,6,7,8]);
  const id=store.createProject({code:'SITE-01',customer:'Synthetic Customer',siteAddress:'101 Example'});
  store.updateBusinessProfile({legalName:'Demo Electric',tradeName:'Demo',phone:'555',email:'demo@example.test',mailingAddress:'PO Box 2',taxId:'TEST-TAX',contractorLicense:'TEST-ELEC'});
  store.updateProjectDetails(id,{name:'Panel change',billingAddress:'100 Billing St',notes:'Saturday work'});
  store.setProjectStatus(id,'complete');store.close();store=new LocalStore(file);
  assert.equal(store.getBusinessProfile().contractorLicense,'TEST-ELEC');
  assert.equal(store.listProjectsDetailed()[0].billing_address,'100 Billing St');
  assert.equal(store.listProjectsDetailed()[0].status,'complete');
  assert.equal((store.db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as any).count,8);
  store.setProjectStatus(id,'archived');store.setProjectStatus(id,'active');
  assert.equal(store.listProjectsDetailed()[0].status,'active');
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('migration tamper detection refuses altered installed SQL',()=>{
 const dir=temp();try{
  const migrationRoot=path.resolve('packages/persistence-sqlite/src/migrations');const tmp=path.join(dir,'migrations');fs.cpSync(migrationRoot,tmp,{recursive:true});
  const dbFile=path.join(dir,'app.sqlite');new LocalStore(dbFile,tmp).close();
  fs.appendFileSync(path.join(tmp,'0002-material-dispositions.sql'),'\n-- tamper\n');
  assert.throws(()=>new LocalStore(dbFile,tmp),/Migration history mismatch/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing middle migration record fails closed without rewriting history',()=>{
 const dir=temp();try{
  const file=path.join(dir,'app.sqlite');let db=new LocalStore(file);db.initializeFictionalCompany();
  db.createProject({code:'HISTORY-GAP',customer:'Synthetic',siteAddress:'1 Test Road'});
  db.db.prepare('DELETE FROM schema_migrations WHERE version=2').run();
  const before=db.db.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all();db.close();
  assert.throws(()=>new LocalStore(file),/Migration history mismatch/);
  const {DatabaseSync}=require('node:sqlite') as typeof import('node:sqlite');
  const inspect=new DatabaseSync(file,{readOnly:true});try{
   assert.deepEqual(inspect.prepare('SELECT version,checksum FROM schema_migrations ORDER BY version').all(),before);
   assert.equal((inspect.prepare('SELECT count(*) AS n FROM projects').get() as {n:number}).n,1);
  }finally{inspect.close();}
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});


test('two independent SQLite connections safely conflict and retry without duplicate invoice allocation or audit rows',()=>{
 const dir=temp(),file=path.join(dir,'ledger.sqlite');
 let first:LocalStore|undefined,second:DatabaseSync|undefined;
 try{
  first=new LocalStore(file);first.initializeFictionalCompany();
  const project=first.createProject({code:'CONTENTION',customer:'Synthetic',siteAddress:'Test'});
  second=new DatabaseSync(file,{timeout:0});second.exec('PRAGMA foreign_keys=ON; PRAGMA recursive_triggers=ON; PRAGMA busy_timeout=0;');
  const write=(db:DatabaseSync,id:string,number:string)=>{
   db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('synthetic.reserve',id,'2026-11-23T00:00:00Z');
   db.prepare('INSERT INTO issued_invoices(id,project_id,invoice_number,immutable_body_json,issued_utc,amount_cents,pdf_sha256,pdf_locator) VALUES(?,?,?,?,?,?,?,?)').run(id,project,number,'{}','2026-11-23T00:00:00Z',1000,'a'.repeat(64),'issued/synthetic.pdf');
  };
  const a=first.db,b=second;
  withImmediateTransaction(a,()=>{
   write(a,'first','SYN-001');
   assert.throws(()=>withImmediateTransaction(b,()=>write(b,'second','SYN-001')),/locked|busy/i);
   assert.equal((b.prepare('SELECT count(*) AS n FROM issued_invoices').get() as {n:number}).n,0);
  });
  assert.throws(()=>withImmediateTransaction(b,()=>write(b,'second','SYN-001')),/UNIQUE constraint/i);
  assert.throws(()=>withImmediateTransaction(b,()=>{write(b,'rollback','SYN-002');throw new Error('Synthetic interruption after reservation');}),/interruption/);
  withImmediateTransaction(b,()=>write(b,'retry','SYN-002'));
  second.close();second=undefined;first.close();first=undefined;
  first=new LocalStore(file);
  assert.deepEqual(first.db.prepare('SELECT invoice_number,id FROM issued_invoices ORDER BY invoice_number').all().map(r=>[r.invoice_number,r.id]),[['SYN-001','first'],['SYN-002','retry']]);
  assert.deepEqual(first.db.prepare("SELECT entity_id FROM audit_events WHERE action='synthetic.reserve' ORDER BY entity_id").all().map(r=>r.entity_id),['first','retry']);
  assert.equal((first.db.prepare('PRAGMA quick_check').get() as {quick_check:string}).quick_check,'ok');
  assert.deepEqual(first.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{second?.close();first?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('a killed contending writer rolls back reservation, invoice, audit and receipt; retry commits exactly once',async()=>{
 const {spawn}=await import('node:child_process');const {randomUUID}=await import('node:crypto');
 const dir=temp(),file=path.join(dir,'ledger.sqlite'),op=randomUUID(),next=randomUUID();
 let store:LocalStore|undefined,child:ReturnType<typeof spawn>|undefined;
 try{
  store=new LocalStore(file);store.initializeFictionalCompany();const project=store.createProject({code:'CRASH-WRITER',customer:'Synthetic',siteAddress:'Test'});
  // This counter is confined to the disposable test. It does not invent the later-phase numbering policy.
  store.db.exec('CREATE TABLE synthetic_reservation_counter(n INTEGER NOT NULL) STRICT; INSERT INTO synthetic_reservation_counter VALUES(0); PRAGMA busy_timeout=0;');
  const readState=(db:DatabaseSync)=>({counter:db.prepare('SELECT n FROM synthetic_reservation_counter').get()?.n,invoices:db.prepare('SELECT id,invoice_number FROM issued_invoices ORDER BY invoice_number').all(),audit:db.prepare("SELECT entity_id FROM audit_events WHERE action='synthetic.reserve' ORDER BY entity_id").all(),receipts:db.prepare('SELECT operation_id,channel FROM operation_receipts ORDER BY operation_id').all()});
  const before=readState(store.db);
  const write=(s:LocalStore,id:string,fail?:'first'|'reserve')=>s.mutateOnce(id,'synthetic.reserve',()=>{
   s.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('synthetic.reserve',id,'2026-11-23T00:00:00Z');
   if(fail==='first')throw new Error('Synthetic first-write abort');
   const n=s.db.prepare('UPDATE synthetic_reservation_counter SET n=n+1 RETURNING n').get()!.n;
   if(fail==='reserve')throw new Error('Synthetic number-reservation abort');
   s.db.prepare('INSERT INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)').run(id,project,'SYN-'+n,'{}','2026-11-23',100,'a'.repeat(64),'issued/synthetic.pdf');
  });
  for(const fail of ['first','reserve'] as const){assert.throws(()=>write(store!,op,fail),/Synthetic/);assert.deepEqual(readState(store.db),before);}
  const script=`const fs=require('node:fs');const {LocalStore}=require(process.argv[1]);const s=new LocalStore(process.argv[2]);const op=process.argv[3],project=process.argv[4];
   s.mutateOnce(op,'synthetic.reserve',()=>{s.db.prepare('INSERT INTO audit_events(action,entity_id,occurred_utc) VALUES(?,?,?)').run('synthetic.reserve',op,'2026-11-23T00:00:00Z');const n=s.db.prepare('UPDATE synthetic_reservation_counter SET n=n+1 RETURNING n').get().n;s.db.prepare('INSERT INTO issued_invoices VALUES (?,?,?,?,?,?,?,?)').run(op,project,'SYN-'+n,'{}','2026-11-23',100,'a'.repeat(64),'issued/synthetic.pdf');if(!s.db.isTransaction)throw Error('Expected active transaction');fs.writeSync(1,'RESERVED_BEFORE_COMMIT\\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);throw Error('Missing parent kill');});`;
  child=spawn(process.execPath,['-e',script,require.resolve('../../packages/persistence-sqlite/src/connection'),file,op,project],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const interrupted=child;const active=store;
  const outcome=await new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{
   let output='',stderr='',reached=false,assertionFailure:unknown;
   const deadline=setTimeout(()=>{interrupted.kill('SIGKILL');reject(Error('Writer did not reach reservation barrier'));},15000);
   interrupted.stdout!.on('data',b=>{output+=String(b);if(!reached&&output.includes('RESERVED_BEFORE_COMMIT\n')){reached=true;try{assert.deepEqual(readState(active.db),before);assert.throws(()=>write(active,next),/locked|busy/i);assert.deepEqual(readState(active.db),before);}catch(error){assertionFailure=error;}if(!interrupted.kill('SIGKILL')){clearTimeout(deadline);reject(Error('Could not terminate writer'));}}});
   interrupted.stderr!.on('data',b=>{stderr+=String(b);});
   interrupted.once('error',error=>{clearTimeout(deadline);reject(error);});
   interrupted.once('close',(code,signal)=>{clearTimeout(deadline);if(assertionFailure)reject(assertionFailure);else if(!reached)reject(Error('Writer failed before reservation: '+stderr.slice(-500)));else resolve({code,signal});});
  });
  assert.ok(outcome.signal==='SIGKILL'||(outcome.code!==null&&outcome.code!==0));
  store.close();store=new LocalStore(file);assert.deepEqual(readState(store.db),before);
  write(store,op);assert.throws(()=>write(store!,op),/duplicate mutation/);write(store,next);
  store.close();store=new LocalStore(file);const state=readState(store.db);
  assert.equal(state.counter,2);assert.deepEqual(state.invoices.map(r=>[r.id,r.invoice_number]),[[op,'SYN-1'],[next,'SYN-2']]);assert.deepEqual(state.audit.map(r=>r.entity_id),[op,next].sort());assert.deepEqual(state.receipts.map(r=>r.operation_id),[op,next].sort());
  assert.equal(store.db.prepare('PRAGMA quick_check').get()?.quick_check,'ok');assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{if(child&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');store?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('approved half-day overhead oracles persist and query exact allocated and unallocated cents across restart',async()=>{
 const {allocateDailyOverhead}=await import('../../packages/domain/src/overhead/allocation');
 const dir=temp(),file=path.join(dir,'overhead.sqlite');let store:LocalStore|undefined;
 try{
  store=new LocalStore(file);store.initializeFictionalCompany();const a=store.createProject({code:'A',customer:'Synthetic',siteAddress:'Site'}),b=store.createProject({code:'B',customer:'Synthetic',siteAddress:'Site'});
  // Fixture-only writes exercise the approved domain primitive and existing SQLite contracts.
  // No later-phase overhead application workflow is introduced.
  const rows=[{day:'2026-11-20',total:30000n,work:[],expected:[0n,30000n]},
   {day:'2026-11-21',total:30000n,work:[{projectId:a,halfDays:1 as const}],expected:[15000n,15000n]},
   {day:'2026-11-22',total:30000n,work:[{projectId:a,halfDays:1 as const},{projectId:b,halfDays:1 as const}],expected:[30000n,0n]},
   {day:'2026-11-23',total:101n,work:[{projectId:a,halfDays:1 as const}],expected:[51n,50n]},
   {day:'2026-11-24',total:9007199254740993n,work:[{projectId:b,halfDays:1 as const}],expected:[4503599627370497n,4503599627370496n]}];
  for(const row of rows){const proof=allocateDailyOverhead(row.total,row.work);withImmediateTransaction(store.db,()=>{
   store!.db.prepare('INSERT INTO overhead_daily VALUES(?,?,?)').run(row.day,row.total,'2026-11-24T00:00:00Z');
   for(const entry of row.work)store!.db.prepare('INSERT INTO overhead_project_days VALUES(?,?,?,?)').run(row.day,entry.projectId,entry.halfDays,proof.allocations.find(x=>x.projectId===entry.projectId)!.allocatedCents);
  });assert.equal(proof.unallocatedCents,row.expected[1]);}
  assert.throws(()=>store!.db.prepare('INSERT INTO overhead_project_days VALUES(?,?,?,?)').run('2026-11-22',a,2,30000),/capacity|UNIQUE/);
  store.close();store=new LocalStore(file);
  const query=store.db.prepare('SELECT d.day,d.estimate_cents,COALESCE(SUM(p.allocated_cents),0) AS allocated,d.estimate_cents-COALESCE(SUM(p.allocated_cents),0) AS unallocated FROM overhead_daily d LEFT JOIN overhead_project_days p ON p.day=d.day GROUP BY d.day ORDER BY d.day');query.setReadBigInts(true);
  const persisted=query.all();assert.deepEqual(persisted.map(r=>[r.day,r.estimate_cents,r.allocated,r.unallocated]),rows.map(r=>[r.day,r.total,...r.expected]));
  for(const r of persisted)assert.equal((r.allocated as bigint)+(r.unallocated as bigint),r.estimate_cents);
  assert.equal(store.db.prepare('PRAGMA quick_check').get()?.quick_check,'ok');assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('unsupported future migration history refuses startup without rewriting the existing database',()=>{
 const dir=temp(),file=path.join(dir,'future.sqlite');
 try{
  let store=new LocalStore(file);store.initializeFictionalCompany();const id=store.createProject({code:'FUTURE',customer:'Synthetic',siteAddress:'Site'});
  store.db.prepare('INSERT INTO schema_migrations VALUES(?,?,?)').run(999,'a'.repeat(64),'2026-11-24T00:00:00Z');const before=store.db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();store.close();const bytes=fs.readFileSync(file);
  for(let i=0;i<2;i++)assert.throws(()=>new LocalStore(file),/Migration history mismatch/);
  assert.deepEqual(fs.readFileSync(file),bytes);const inspect=new DatabaseSync(file,{readOnly:true});try{assert.deepEqual(inspect.prepare('SELECT * FROM schema_migrations ORDER BY version').all(),before);assert.equal(inspect.prepare('SELECT id FROM projects').get()?.id,id);}finally{inspect.close();}
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
