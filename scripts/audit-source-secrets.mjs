import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const excluded=new Set(['node_modules','dist-probe','.vite','out','.git','coverage','dist','.local-evidence']);
const limit=16*1024*1024;
// Known-signature screening is not a guarantee that arbitrary secrets are absent.
const privatePatterns=[
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'private key material'],
  [/\b(?:sk-ant-api03-|sk-proj-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]{16,}/,'provider access token'],
  [/\bAKIA[0-9A-Z]{16}\b/,'AWS access key ID']
];
const reasons=content=>privatePatterns.filter(([pattern])=>pattern.test(content)).map(([,reason])=>reason);
const safeLabel=rel=>reasons(rel).length?'[REDACTED_PATH]':rel;
function checkedBytes(file){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{
  const initial=fs.fstatSync(fd);
  const verify=()=>{const n=fs.lstatSync(file),s=fs.fstatSync(fd);if(!initial.isFile()||initial.nlink!==1||!n.isFile()||n.isSymbolicLink()||n.nlink!==1||s.nlink!==1||initial.size>limit||n.dev!==initial.dev||n.ino!==initial.ino||s.dev!==initial.dev||s.ino!==initial.ino||n.size!==initial.size||s.size!==initial.size||n.mtimeMs!==initial.mtimeMs||s.mtimeMs!==initial.mtimeMs||n.ctimeMs!==initial.ctimeMs||s.ctimeMs!==initial.ctimeMs)throw new Error('Unsafe, oversized or changed scan input');};
  verify();const bytes=Buffer.alloc(initial.size);let offset=0;
  while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)throw new Error('Short scan input read');offset+=n;}
  verify();return bytes;
 }finally{fs.closeSync(fd);}
}
function scanTree(folder,sourceOnly){
 const findings=[];let scanned=0;
 const add=(rel,reason)=>findings.push({path:safeLabel(rel),reason});
 const canonical=fs.realpathSync(folder);
 if(fs.lstatSync(folder).isSymbolicLink())throw new Error('Linked scan root');
 function visit(dir){
  if(fs.realpathSync(dir)!==dir)throw new Error('Redirected scan directory');
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const f=path.join(dir,entry.name),rel=path.relative(canonical,f).split(path.sep).join('/');
   for(const reason of reasons(rel))add(rel,reason+' in path');
   if(entry.isSymbolicLink()){add(rel,'unexpected symbolic link');continue;}
   if(entry.isDirectory()){if(!sourceOnly||!excluded.has(entry.name))visit(f);continue;}
   if(!entry.isFile()){add(rel,'unexpected nonregular scan input');continue;}
   if(/(^|\/)\.env(?:\..+)?$/.test(rel)&&!rel.endsWith('.env.example'))add(rel,'environment secrets file');
   try{
    // ASCII signature search remains effective in NUL-containing data; do not skip binary bytes.
    const bytes=checkedBytes(f);scanned++;for(const reason of reasons(bytes.toString('latin1')))add(rel,reason);
   }catch{add(rel,'unsafe, oversized or changed scan input; review required');}
  }
 }
 visit(canonical);return {scanned,findings};
}
function nativeEvidenceAdmission(projectRoot){
 const folder=path.join(projectRoot,'.local-evidence');const findings=[];let scanned=0,folders=0;
 if(!fs.existsSync(folder)||fs.lstatSync(folder).isSymbolicLink())return {scanned,folders,findings:[{path:'.local-evidence',reason:'missing or linked native evidence root'}]};
 for(const entry of fs.readdirSync(folder,{withFileTypes:true}).filter(x=>x.name.startsWith('native-'))){
  // The workflow uploads only native-* directories, not the collector tar archives.
  if(entry.isFile()&&entry.name.endsWith('.tar.gz'))continue;
  if(!entry.isDirectory()||entry.isSymbolicLink()){findings.push({path:safeLabel(entry.name),reason:'unexpected native evidence object'});continue;}
  folders++;try{const result=scanTree(path.join(folder,entry.name),false);scanned+=result.scanned;for(const f of result.findings)findings.push({path:safeLabel(entry.name)+'/'+f.path,reason:f.reason});if(!result.scanned)findings.push({path:safeLabel(entry.name),reason:'empty native evidence directory'});}catch{findings.push({path:safeLabel(entry.name),reason:'native evidence cannot be safely scanned'});}
 }
 if(!folders)findings.push({path:'.local-evidence',reason:'no native evidence directories'});
 return {scanned,folders,findings};
}
function selfTest(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tm-secret-audit-'));
 try{
  const token='gh'+'p_'+'A'.repeat(24),filename='fixture.log';
  fs.writeFileSync(path.join(tmp,'clean.txt'),'synthetic ordinary bytes');assert.equal(scanTree(tmp,true).findings.length,0);
  for(const [name,bytes] of [['plain.txt',Buffer.from(token)],['binary.bin',Buffer.concat([Buffer.from([0]),Buffer.from(token)])],['large.txt',Buffer.concat([Buffer.alloc(2000001,97),Buffer.from('\n'+token)])]]){
   const f=path.join(tmp,name);fs.writeFileSync(f,bytes);const r=scanTree(tmp,true);assert.equal(r.findings.length,1);assert.equal(r.findings[0].path,name);assert.ok(!JSON.stringify(r).includes(token));fs.unlinkSync(f);
  }
  const huge=path.join(tmp,'oversized.bin'),fd=fs.openSync(huge,'wx');try{fs.ftruncateSync(fd,limit+1);}finally{fs.closeSync(fd);}
  assert.equal(scanTree(tmp,true).findings.length,1);fs.unlinkSync(huge);
  const evidence=path.join(tmp,'.local-evidence','native-fixture');fs.mkdirSync(evidence,{recursive:true});
  fs.writeFileSync(path.join(evidence,filename),token);assert.equal(scanTree(tmp,true).findings.length,0);const refused=nativeEvidenceAdmission(tmp);assert.equal(refused.findings.length,1);assert.ok(!JSON.stringify(refused).includes(token));
  fs.writeFileSync(path.join(evidence,filename),'redacted synthetic failure receipt');assert.equal(nativeEvidenceAdmission(tmp).findings.length,0);
  fs.rmSync(evidence,{recursive:true,force:true});assert.equal(nativeEvidenceAdmission(tmp).findings.length,1);
  console.log('PASS: synthetic source and native-evidence secret admission negatives (known signatures only)');
 }finally{fs.rmSync(tmp,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
try{
 if(process.argv.includes('--self-test'))selfTest();
 const native=process.argv.includes('--native-evidence'),failureEvidence=process.argv.includes('--source-failure-evidence');
 if(native&&failureEvidence)throw new Error('Choose one evidence admission scope');
 const result=native?nativeEvidenceAdmission(root):failureEvidence?scanTree(path.join(root,'dist-probe'),false):scanTree(root,true);
 console.log(JSON.stringify({checked:native?'native evidence directories before upload (known signatures)':failureEvidence?'source failure evidence before upload (known signatures)':'source tree (known signatures, no external registry)',scanned:result.scanned,findingCount:result.findings.length,findings:result.findings},null,2));
 if(result.findings.length)process.exitCode=1;
}catch{
 // A filesystem or assertion exception may itself contain a secret-bearing path/value.
 console.error('Secret admission could not safely complete; upload refused.');process.exitCode=1;
}
