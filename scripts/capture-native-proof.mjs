/** Fork B: collect ACTUAL target-host evidence. Safe on synthetic isolated proof data only.
 * Does not mark any Phase 2 acceptance case PASS or authorize public release.
 * Run with Node >=24 on an actual supported macOS arm64 or Windows x64 host.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const args=process.argv.slice(2);
const execution=args.includes('--execute');
const plan=args.includes('--plan') || !execution;
const projectPkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const expectedPkg='pnpm@12.21.0';
const commands=[
  ['install',['--yes',expectedPkg,'install','--frozen-lockfile']],
  ['local-tests',['--yes',expectedPkg,'test']],
  ['desktop-typecheck',['--yes',expectedPkg,'desktop:typecheck']],
  ['source-quality',['--yes',expectedPkg,'quality:source']],
  ['smoke-contract',['scripts/run-packaged-smoke.mjs','--self-test']],
  ['module-audit',['scripts/audit-repo-structure.mjs']],
  ['packaged-build',['--yes',expectedPkg,'--filter','@electrical-tm/desktop','make',`--platform=${process.platform==='darwin'?'darwin':process.platform==='win32'?'win32':'<NATIVE_HOST_REQUIRED>'}`,`--arch=${process.platform==='darwin'?'arm64':process.platform==='win32'?'x64':'<NATIVE_HOST_REQUIRED>'}`]],
  ['native-packaged-smoke',['scripts/run-packaged-smoke.mjs']]
];
const sha=(buffer)=>crypto.createHash('sha256').update(buffer).digest('hex');
const scrub=(input)=>String(input??'')
  .replaceAll(os.homedir(),'<HOME>')
  .replace(/\b(?:sk-ant-|sk-proj-|sk-)[A-Za-z0-9_-]{12,}\b/gi,'<REDACTED_API_SECRET>')
  .replace(/\bBearer\s+[^\s]+/gi,'Bearer <REDACTED>')
  .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)\s*[:=]\s*['\"]?[^'\"\s,}]+/gi,'<REDACTED_CREDENTIAL>')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'<REDACTED_EMAIL>');
const stopWords=new Set(['node_modules','.git','.vite','out','dist','dist-probe','.local-evidence','coverage','.next']);
function walk(dir,prefix=''){
  const all=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(stopWords.has(entry.name)||entry.name.startsWith('.env'))continue;
    const rel=prefix?`${prefix}/${entry.name}`:entry.name;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())all.push(...walk(full,rel));
    else if(entry.isFile())all.push({path:rel,sha256:sha(fs.readFileSync(full))});
  }
  return all;
}
function fileSha(file){return sha(fs.readFileSync(file))}
function dateId(){return new Date().toISOString().replace(/[:.]/g,'-')}
function checkPrereqs(){
  const failures=[];
  if(!fs.existsSync(path.join(root,'pnpm-workspace.yaml')))failures.push('No pnpm-workspace.yaml at source root');
  if(Number(process.versions.node.split('.')[0])<24)failures.push('Node 24+ required to execute (use Node 24 for preferred proof)');
  if(!['darwin','win32'].includes(process.platform))failures.push('Execution must run on macOS or Windows, not Linux');
  if(process.platform==='darwin'&&process.arch!=='arm64')failures.push('This proof targets macOS arm64; separate evidence needed for Mac x64');
  if(process.platform==='win32'&&process.arch!=='x64')failures.push('This proof targets Windows x64');
  return failures;
}
if(args.includes('--fingerprint')){const files=walk(root);console.log(sha(files.map(x=>`${x.path}\t${x.sha256}`).join('\n')));process.exit(0)}
if(plan){
  const files=walk(root); const currentFingerprint=sha(files.map(x=>`${x.path}\t${x.sha256}`).join('\n'));
  console.log(JSON.stringify({mode:'PLAN_ONLY_NOT_EXECUTED',sourceFingerprint:currentFingerprint,sourceRoot:root,productVersion:projectPkg.version,host:{platform:process.platform,arch:process.arch,node:process.version},required:'Node 24+; native macOS arm64 or Windows x64; npm registry; clean synthetic environment',steps:commands.map(([id,argv])=>({id,command:['module-audit','smoke-contract','native-packaged-smoke'].includes(id)?`node ${argv.join(' ')}`:`npx ${argv.join(' ')}`})),acceptance:'Every Phase 2 case remains OPEN until required native/manual/reviewer proof is verified.'},null,2));
  process.exit(0);
}
const problems=checkPrereqs();
if(problems.length){console.error(JSON.stringify({verdict:'BLOCKED',problems},null,2));process.exit(2)}
const stamp=dateId();
const out=path.join(root,'.local-evidence',`native-${process.platform}-${process.arch}-${stamp}`);
fs.mkdirSync(path.join(out,'logs'),{recursive:true,mode:0o700});
const source=walk(root); const sourceFingerprint=sha(source.map(x=>`${x.path}\t${x.sha256}`).join('\n'));
const host={platform:process.platform,architecture:process.arch,release:os.release(),osType:os.type(),node:process.version,pnpmPinned:expectedPkg,appVersion:projectPkg.version,sourceFingerprint};
fs.writeFileSync(path.join(out,'host.json'),JSON.stringify(host,null,2)+'\n');
let tests=[];
for(const [id,argv] of commands){
  const isNode=['module-audit','smoke-contract','native-packaged-smoke'].includes(id);
  const bin=isNode?process.execPath:(process.platform==='win32'?'npx.cmd':'npx');
  const started=new Date();
  const res=spawnSync(bin,argv,{cwd:root,encoding:'utf8',timeout:id==='packaged-build'?1200000:600000,maxBuffer:16*1024*1024,windowsHide:true,shell:process.platform==='win32'&&!isNode,env:{...process.env,CI:'1'}});
  const output=scrub((res.stdout||'')+'\n'+(res.stderr||'')).slice(-300000);
  fs.writeFileSync(path.join(out,'logs',`${id}.log`),output,{mode:0o600});
  const status=res.error?'FAIL':res.status===0?'PASS':'FAIL';
  const item={id,status,exitCode:res.status,signal:res.signal,startedUTC:started.toISOString(),finishedUTC:new Date().toISOString(),log:`logs/${id}.log`,note:res.error?scrub(res.error.message):null};
  tests.push(item);
  console.log(`${id}: ${status}`);
  if(status!=='PASS')break;
}
const candidates=[];
const make=path.join(root,'apps/desktop/out/make');
if(fs.existsSync(make)){
  const gather=(dir)=>{
    for(const x of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,x.name);
      if(x.isDirectory())gather(file);
      else if(x.isFile() && /\.(zip|dmg|exe|msi|deb|rpm)$/i.test(x.name))candidates.push({name:path.relative(root,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:fileSha(file)});
    }
  };gather(make);
}
const overall=tests.length===commands.length&&tests.every(x=>x.status==='PASS')?'NATIVE_AUTOMATED_SUBSET_PASS':'NATIVE_AUTOMATED_SUBSET_FAIL';
const report={kind:'fork-b-native-proof',contractVersion:'2',verdict:overall,formalAcceptanceVerdict:'UNASSESSED',testedSourceFingerprint:sourceFingerprint,host,steps:tests,artifactHashes:candidates,manualTests:'NOT_EXECUTED_BY_AUTOMATION',independentReview:'NOT_EXECUTED_BY_AUTOMATION',notice:'This report does not certify 30/30 acceptance cases, novice installation, OS secrets storage or release.'};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'manual-evidence-template.json'),JSON.stringify({hostFingerprint:sourceFingerprint,scenarios:[],reviewer:null,notes:'Use only synthetic data; link screenshot file hashes; unrun cases stay NOT_RUN'},null,2)+'\n');
fs.writeFileSync(path.join(out,'SHARE_SAFELY.md'),`# Fork B native evidence\n\nResult: ${overall}\n\nGenerated from source fingerprint ${sourceFingerprint}.\n\nThis folder contains best-effort redacted logs, hashes and no intentional project data. **Inspect every log before uploading; never upload real keys, customer files or Application Support data.**\n\nAll 30 formal acceptance cases remain unassessed until per-case proof and review.\n`);
const evidence=walk(out); const manifest={files:evidence,manifestSha256:sha(evidence.map(x=>x.path+' '+x.sha256).join('\n'))};
fs.writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
// GNU/BSD tar is available on standard macOS and modern Windows. Preserve folder if unavailable.
const archive=out+'.tar.gz';const t=spawnSync('tar',['-czf',archive,'-C',path.dirname(out),path.basename(out)],{encoding:'utf8',timeout:60000});
if(t.status===0)console.log(`Evidence archive: ${archive}`);
else console.log(`Evidence folder (tar unavailable): ${out}`);
console.log(`Evidence directory: ${out}\nSource fingerprint: ${sourceFingerprint}\nVerdict: ${overall}\nNOTE: inspect and upload only synthetic/redacted evidence.`);
process.exitCode=overall==='NATIVE_AUTOMATED_SUBSET_PASS'?0:1;
