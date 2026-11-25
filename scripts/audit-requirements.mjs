import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const pad=n=>String(n).padStart(2,'0');
const cases=Array.from({length:30},(_,i)=>`P2-AC${pad(i+1)}`);
const tasks=Array.from({length:12},(_,i)=>`P2-F${pad(i+1)}`);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
/** Hash/read the checked descriptor rather than following a replaced pathname. */
function checkedSourceBytes(file,limit=64*1024*1024){
 let fd;
 try{fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));}
 catch(error){if(error?.code==='ENOENT')throw new Error('Required source file missing');throw error;}
 try{
  const initial=fs.fstatSync(fd);
  const verify=()=>{const stat=fs.fstatSync(fd),named=fs.lstatSync(file);if(!stat.isFile()||!named.isFile()||named.isSymbolicLink()||stat.nlink!==1||named.nlink!==1||stat.dev!==named.dev||stat.ino!==named.ino||stat.size!==initial.size||stat.size!==named.size||stat.mtimeMs!==initial.mtimeMs||stat.size>limit)throw new Error('Unsafe or changed regular source file');};
  verify();const bytes=Buffer.alloc(initial.size);let offset=0;while(offset<bytes.length){const count=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!count)throw new Error('Changed source file');offset+=count;}verify();return bytes;
 }finally{fs.closeSync(fd);}
}
const read=p=>checkedSourceBytes(p).toString('utf8');
const pinned='12.21.0';
const required=['README.md','LICENSE','SECURITY.md','PRIVACY.md','CONTRIBUTING.md','package.json','pnpm-lock.yaml','apps/desktop/forge.config.ts','apps/desktop/vite.renderer.config.ts','apps/desktop/index.html','packages/persistence-sqlite/src/connection.ts','packages/domain/src/shared/money.ts','packages/backup/src/create-backup.ts','packages/backup/src/restore-backup.ts'];
function auditTrace(matrix,hasFile){
 const errors=[],pending=[],seenTasks=new Set(),seenCases=new Set();
 const rows=[...matrix.matchAll(/^\| (P2-AC\d{2}) \|/gm)].map(m=>m[1]);
 if(rows.length!==30||new Set(rows).size!==30||cases.some(id=>!rows.includes(id)))errors.push('Original 30 acceptance IDs missing, duplicated or changed');
 let data;
 try{data=JSON.parse(matrix.split('## Source traceability inventory')[1].match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);}catch{throw new Error('Traceability inventory malformed or missing');}
 if(!Array.isArray(data))throw new Error('Traceability inventory not an array');
 for(const row of data){
  if(!tasks.includes(row.task)||seenTasks.has(row.task)){errors.push('Unexpected or duplicate task ID');continue;}
  seenTasks.add(row.task);
  if(!Array.isArray(row.requirements)||!row.requirements.length||row.requirements.some(id=>typeof id!=='string'||!/^[A-Z]+-(?:R)?\d+$/.test(id)))errors.push(`${row.task}: requirement mapping invalid`);
  if(!Array.isArray(row.cases)||!row.cases.length||row.cases.some(id=>!cases.includes(id)))errors.push(`${row.task}: case mapping invalid`);
  for(const id of row.cases??[])seenCases.add(id);
  if(!Array.isArray(row.implementedPaths)||!Array.isArray(row.pendingPaths)||!row.implementedPaths.length)throw new Error(`${row.task}: source inventory malformed`);
  const all=[...row.implementedPaths,...row.pendingPaths];
  if(new Set(all).size!==all.length||all.some(p=>typeof p!=='string'||!p||p.includes('\\')||p.includes(':')||p.startsWith('/')||p.split('/').includes('..')))errors.push(`${row.task}: invalid path inventory`);
  for(const p of row.implementedPaths)if(!hasFile(p))errors.push(`${row.task}: required implemented path missing: ${p}`);
  for(const p of row.pendingPaths){if(hasFile(p))errors.push(`${row.task}: implemented path needs inventory reconciliation: ${p}`);else pending.push({task:row.task,path:p});}
  for(const [old,effective] of Object.entries(row.approvedExceptions??{}))if(old!=='apps/desktop/src/renderer/index.html'||effective!=='apps/desktop/index.html'||row.task!=='P2-F02'||!hasFile(effective)||hasFile(old))errors.push(`${row.task}: unauthorized or absent path exception`);
 }
 if(tasks.some(id=>!seenTasks.has(id)))errors.push('Original 12 task IDs not all mapped');
 if(cases.some(id=>!seenCases.has(id)))errors.push('Some acceptance IDs have no task mapping');
 return {tasks:seenTasks.size,cases:seenCases.size,pending,errors};
}
function command(bin,args,cwd=root,input){
 const r=spawnSync(bin,args,{cwd,encoding:'utf8',input,timeout:120000,maxBuffer:4*1024*1024,windowsHide:true,shell:process.platform==='win32'&&bin==='pnpm.cmd'});
 if(r.error)throw r.error;return r;
}
const pnpm=process.platform==='win32'?'pnpm.cmd':'pnpm';
function pn(args,cwd=root,input){return command(pnpm,args,cwd,input);}
function mustOutput(r,label){if(r.status!==0)throw new Error(`${label} failed (exit ${r.status})`);return r.stdout.trim();}
function checkLinker(value){if(value!=='hoisted')throw new Error('Effective pnpm node-linker must be hoisted');}
function checkLock(dir,requireGit=false){
 const file=path.join(dir,'pnpm-lock.yaml');const bytes=checkedSourceBytes(file);if(bytes.length===0)throw new Error('Required frozen lockfile empty');
 const inGit=command('git',['rev-parse','--is-inside-work-tree'],dir);
 if(inGit.status!==0){if(requireGit)throw new Error('Canonical Git checkout required for CI lock verification');return {status:'ARCHIVE_ONLY_NO_GIT_PROOF',sha256:sha(bytes)};}
 if(command('git',['ls-files','--error-unmatch','pnpm-lock.yaml'],dir).status!==0||command('git',['diff','--quiet','HEAD','--','pnpm-lock.yaml'],dir).status!==0)throw new Error('Frozen lockfile absent from tracked HEAD or changed');
 if(!checkedSourceBytes(file).equals(bytes))throw new Error('Frozen lockfile changed during verification');
 return {status:'TRACKED_LOCK_MATCHES_HEAD',sha256:sha(bytes)};
}
function selfTest(matrix){
 const yes=()=>true;
 const data=JSON.parse(matrix.split('## Source traceability inventory')[1].match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
 const present=new Set(data.flatMap(r=>[...r.implementedPaths,...Object.values(r.approvedExceptions??{})]));
 assert.equal(auditTrace(matrix,p=>present.has(p)).errors.length,0);
 assert.equal(auditTrace(matrix.replace(/\r?\n/g,'\r\n'),p=>present.has(p)).errors.length,0);
 assert.ok(auditTrace(matrix.replace('| P2-AC01 |','| P2-AC99 |'),p=>present.has(p)).errors.length);
 const removed=data[0].implementedPaths[0];assert.ok(auditTrace(matrix,p=>p!==removed&&present.has(p)).errors.some(x=>x.includes(removed)));
 assert.throws(()=>checkLinker('isolated'),/hoisted/);
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'tm-lock-audit-'));
 try{
  assert.throws(()=>checkLock(fixture),/missing/);
  fs.writeFileSync(path.join(fixture,'pnpm-lock.yaml'),'lockfileVersion: 9\n');
  mustOutput(command('git',['init','--quiet'],fixture),'fixture git init');
  mustOutput(command('git',['add','pnpm-lock.yaml'],fixture),'fixture git add');
  mustOutput(command('git',['-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.test','-c','commit.gpgsign=false','commit','--quiet','-m','Synthetic lock fixture'],fixture),'fixture git commit');
  assert.equal(checkLock(fixture,true).status,'TRACKED_LOCK_MATCHES_HEAD');
  const hardlink=path.join(fixture,'lock-alias');fs.linkSync(path.join(fixture,'pnpm-lock.yaml'),hardlink);assert.throws(()=>checkLock(fixture,true),/Unsafe/);fs.unlinkSync(hardlink);
  fs.appendFileSync(path.join(fixture,'pnpm-lock.yaml'),'changed: true\n');assert.throws(()=>checkLock(fixture,true),/changed/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 console.log('PASS traceability, missing-source, linker and tracked-lock negative fixtures');
}
function toolchainNegatives(){
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'tm-toolchain-negative-'));
 try{
  fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'synthetic-fixture',version:'1.0.0',private:true,packageManager:`pnpm@${pinned}`,devDependencies:{typescript:'5.9.3'}}));
  fs.writeFileSync(path.join(fixture,'pnpm-workspace.yaml'),'packages: []\nnodeLinker: isolated\n');
  const observed=mustOutput(pn(['config','get','node-linker'],fixture),'wrong-linker fixture');
  assert.equal(observed,'isolated');assert.throws(()=>checkLinker(observed),/hoisted/);
  const missing=pn(['install','--offline','--frozen-lockfile','--ignore-scripts'],fixture);
  assert.notEqual(missing.status,0);assert.match(missing.stdout+missing.stderr,/frozen.lockfile|no.lockfile|lockfile.*(missing|not found)/i);
  fs.writeFileSync(path.join(fixture,'pnpm-lock.yaml'),"lockfileVersion: '9.0'\nimporters:\n  .: {}\n");
  const outdated=pn(['install','--offline','--frozen-lockfile','--ignore-scripts'],fixture);
  assert.notEqual(outdated.status,0);assert.match(outdated.stdout+outdated.stderr,/frozen.lockfile|outdated.lockfile|lockfile.*(not up to date|outdated|incompatible)/i);
  const lint=pn(['exec','eslint','--stdin','--stdin-filename','synthetic-fixture.ts'],root,'debugger;\n');
  assert.notEqual(lint.status,0);assert.match(lint.stdout+lint.stderr,/no-debugger/);
  const bad=path.join(fixture,'bad.ts');fs.writeFileSync(bad,'const wrong: number = "synthetic";\n');
  const compiler=pn(['exec','tsc','--noEmit','--skipLibCheck',bad]);assert.notEqual(compiler.status,0);assert.match(compiler.stdout+compiler.stderr,/TS2322/);
  // Negative check the actual production tsconfig, not just a standalone TypeScript file.
  const production=path.join(root,'apps/desktop/src/renderer/__synthetic_typecheck_denial.ts');
  const negative='export const syntheticTypecheckDenial: number = "synthetic";\n';
  fs.writeFileSync(production,negative,{flag:'wx',mode:0o600});
  try{
   const actual=pn(['desktop:typecheck']);assert.notEqual(actual.status,0);
   assert.match(actual.stdout+actual.stderr,/__synthetic_typecheck_denial\.ts[^\r\n]*TS2322/);
  }finally{if(fs.readFileSync(production,'utf8')===negative)fs.unlinkSync(production);}
  assert.equal(pn(['desktop:typecheck']).status,0,'Production compile must recover after fixture removal');
  console.log('PASS actual wrong-linker, missing/outdated frozen lock, lint and TypeScript negatives, including production config denial and clean rebuild');
 }finally{fs.rmSync(fixture,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
const matrix=read(path.join(root,'docs/testing/acceptance-matrix.md'));
if(process.argv.includes('--self-test'))selfTest(matrix);
if(process.argv.includes('--toolchain-negative'))toolchainNegatives();
const trace=auditTrace(matrix,p=>fs.existsSync(path.join(root,p))&&fs.statSync(path.join(root,p)).isFile());
const absent=required.filter(p=>!fs.existsSync(path.join(root,p)));
const versions=fs.readdirSync(path.join(root,'packages/persistence-sqlite/src/migrations')).filter(x=>/^\d{4}-.*\.sql$/.test(x)).sort();
if(versions.some((x,i)=>Number(x.slice(0,4))!==i+1))throw new Error('Migration versions are not contiguous');
let bootstrap=null;
if(process.argv.includes('--bootstrap')){
 const version=mustOutput(pn(['--version']),'pnpm version');if(version!==pinned)throw new Error('Unexpected pnpm version');
 const linker=mustOutput(pn(['config','get','node-linker']),'effective linker');checkLinker(linker);
 const lock=checkLock(root,process.env.GITHUB_ACTIONS==='true');
 const expected=read(path.join(root,'.nvmrc')).trim();if(process.versions.node!==expected)throw new Error('Node version does not match .nvmrc');
 bootstrap={node:process.versions.node,pnpm:version,nodeLinker:linker,lock};
}
const errors=[...trace.errors,...absent.map(p=>`Required path missing: ${p}`)];
if(process.argv.includes('--require-complete')&&trace.pending.length)errors.push('Original approved task implementation paths remain unresolved');
console.log(JSON.stringify({requiredFiles:required.length,missing:absent,migrations:versions,traceability:trace,bootstrap,status:errors.length?'FAIL':'STRUCTURAL_TRACEABILITY_PASS',errors,note:'No formal acceptance or human review is implied.'},null,2));if(errors.length)process.exitCode=1;
