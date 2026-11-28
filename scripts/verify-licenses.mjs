import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const exact=/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
// Classification only, not legal approval. Include common SPDX license families;
// any unrecognized expression must be reviewed instead of silently omitted.
const known=new Set('MIT MIT-0 ISC Apache-2.0 Apache-1.1 BSD-2-Clause BSD-3-Clause BSD-4-Clause 0BSD CC0-1.0 CC-BY-3.0 CC-BY-4.0 CC-BY-SA-4.0 Unlicense BlueOak-1.0.0 Python-2.0 Zlib WTFPL MPL-2.0 LGPL-2.1 LGPL-2.1-only LGPL-2.1-or-later LGPL-3.0-only LGPL-3.0-or-later GPL-2.0-only GPL-2.0-or-later GPL-3.0-only GPL-3.0-or-later AGPL-3.0-only AGPL-3.0-or-later Artistic-2.0 Unicode-3.0 Unicode-DFS-2016 OFL-1.1 BSD-2-Clause-Patent BSL-1.0'.split(' '));
function recognizedLicense(value,licenseFiles){
 if(typeof value!=='string'||!value.trim())return false;
 if(/^SEE LICENSE IN /i.test(value))return licenseFiles.some(x=>x.name===value.slice(15));
 // Strict identifier/operator whitelist; this is not a complete SPDX parser.
 const tokens=value.match(/[A-Za-z0-9.+-]+|[()]/g)??[];
 return tokens.length>0&&tokens.join('').length===value.replace(/\s/g,'').length&&tokens.every(t=>known.has(t)||['(',')','AND','OR','WITH','Classpath-exception-2.0','LLVM-exception'].includes(t));
}
function inventory(projectRoot,owners){
 const records=[],failures=[],seen=new Set(),missingOptional=[];
 const rel=p=>path.relative(projectRoot,p).split(path.sep).join('/');
 const inside=p=>{const r=path.relative(projectRoot,p);return r!==''&&!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};
 function resolveManifest(base,name){
  let cursor=base;
  for(;;){const candidate=path.join(cursor,'node_modules',name,'package.json');if(fs.existsSync(candidate))return candidate;if(cursor===projectRoot)return null;const parent=path.dirname(cursor);if(parent===cursor)return null;cursor=parent;}
 }
 function walkModules(modules){
  if(!fs.existsSync(modules))return;
  for(const entry of fs.readdirSync(modules,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   if(entry.name.startsWith('.'))continue;
   const candidate=path.join(modules,entry.name);
   if(entry.name.startsWith('@')){
    if(!fs.statSync(candidate).isDirectory())continue;
    for(const child of fs.readdirSync(candidate).sort())visitPackage(path.join(candidate,child));
   }else visitPackage(candidate);
  }
 }
 function visitPackage(candidate){
  const real=fs.realpathSync(candidate);
  if(!inside(real)){failures.push({path:rel(candidate),reason:'package resolves outside workspace'});return;}
  if(seen.has(real)||!fs.statSync(real).isDirectory())return;
  seen.add(real);
  const file=path.join(real,'package.json');
  if(!fs.existsSync(file)){failures.push({path:rel(real),reason:'installed package manifest missing'});return;}
  const pkg=read(file);
  const license=typeof pkg.license==='string'?pkg.license:pkg.license?.type??null;
  const licenseFiles=fs.readdirSync(real,{withFileTypes:true}).filter(x=>x.isFile()&&/^(licen[cs]e|copying|notice|copyright)([._ -]|$)/i.test(x.name)).map(x=>({name:x.name,sha256:digest(path.join(real,x.name))})).sort((a,b)=>a.name.localeCompare(b.name));
  records.push({name:pkg.name??null,version:pkg.version??null,location:rel(real),license,licenseFiles});
  if(typeof pkg.name!=='string'||typeof pkg.version!=='string'||!recognizedLicense(license,licenseFiles))failures.push({path:rel(real),reason:'missing or unrecognized license metadata; independent disposition required'});
  for(const name of Object.keys(pkg.dependencies??{}))if(!(name in (pkg.optionalDependencies??{}))&&!resolveManifest(real,name))failures.push({path:rel(real),reason:`required transitive dependency missing: ${name}`});
  for(const name of Object.keys(pkg.optionalDependencies??{}))if(!resolveManifest(real,name))missingOptional.push({package:pkg.name,name});
  walkModules(path.join(real,'node_modules'));
 }
 for(const owner of owners){
  const base=path.join(projectRoot,owner),pkg=read(path.join(base,'package.json'));
  walkModules(path.join(base,'node_modules'));
  for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
   const found=resolveManifest(base,name);
   if(!found){failures.push({path:owner||'.',reason:`required direct dependency missing: ${name}`});continue;}
   if(read(found).version!==version)failures.push({path:owner||'.',reason:`direct dependency version mismatch: ${name}`});
  }
 }
 return {packages:records.sort((a,b)=>a.location.localeCompare(b.location)),findings:failures,missingOptional};
}
function selfTest(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tm-license-audit-'));
 try{
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({dependencies:{demo:'1.0.0'}}));
  const p=path.join(dir,'node_modules','demo');fs.mkdirSync(p,{recursive:true});
  const manifest=path.join(p,'package.json');
  fs.writeFileSync(manifest,JSON.stringify({name:'demo',version:'1.0.0',license:'MIT'}));
  fs.writeFileSync(path.join(p,'LICENSE'),'synthetic license fixture');
  assert.equal(inventory(dir,['']).findings.length,0);
  fs.writeFileSync(manifest,JSON.stringify({name:'demo',version:'1.0.0'}));
  assert.equal(inventory(dir,['']).findings.length,1);
  fs.writeFileSync(manifest,JSON.stringify({name:'demo',version:'1.0.0',license:'Not-a-recognized-license'}));
  assert.equal(inventory(dir,['']).findings.length,1);
  fs.rmSync(p,{recursive:true,force:true});assert.equal(inventory(dir,['']).findings.length,1);
  console.log('PASS license inventory negative fixtures');
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(process.argv.includes('--self-test'))selfTest();
const license=fs.readFileSync(path.join(root,'LICENSE'),'utf8');
if(!/MIT License/.test(license)||!/(Permission is hereby granted|permission is hereby granted)/.test(license))throw new Error('Expected MIT license text');
const owners=['','apps/desktop'];
for(const owner of owners){const pkg=read(path.join(root,owner,'package.json'));if(pkg.license!=='MIT')throw new Error('Repository/package license mismatch');
 for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies}))if(!exact.test(version))throw new Error(`${owner||'.'}: ${name} must have exact pinned version`);
}
if(process.argv.includes('--source-only'))console.log(JSON.stringify({status:'SOURCE_ONLY',note:'Installed dependency inventory not executed.'}));
else{
 const result=inventory(root,owners);
 console.log(JSON.stringify({status:result.findings.length?'FAIL':'INVENTORY_COMPLETE_REVIEW_REQUIRED',lockfileSha256:digest(path.join(root,'pnpm-lock.yaml')),packageCount:result.packages.length,...result,note:'Metadata and licence-file hashes are evidence, not legal or distribution approval. Review actual license obligations separately.'},null,2));
 if(!result.packages.length||result.findings.length)process.exitCode=1;
}
