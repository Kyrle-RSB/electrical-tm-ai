import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const excluded=new Set(['node_modules','dist-probe','.vite','out','.git','coverage','dist','.local-evidence']);
const findings=[];
const privatePatterns=[
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'private key material'],
  [/\b(?:sk-ant-api03-|sk-proj-|ghp_)[A-Za-z0-9_-]{16,}/,'provider access token'],
  [/\bAKIA[0-9A-Z]{16}\b/,'AWS access key ID']
];
function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
 const f=path.join(folder,entry.name),rel=path.relative(root,f).split(path.sep).join('/');
 if(entry.isSymbolicLink()){findings.push({path:rel,reason:'unexpected source symlink'});continue;}
 if(entry.isDirectory()){if(!excluded.has(entry.name))visit(f);continue;}
 if(!entry.isFile())continue;
 if(/(^|\/)\.env(?:\..+)?$/.test(rel)&&!rel.endsWith('.env.example')){findings.push({path:rel,reason:'environment secrets file'});continue;}
 const stat=fs.statSync(f);if(stat.size>2_000_000)continue;
 const data=fs.readFileSync(f);if(data.includes(0))continue;
 const content=data.toString('utf8');
 for(const [pattern,reason] of privatePatterns)if(pattern.test(content))findings.push({path:rel,reason});
 }}
visit(root);
console.log(JSON.stringify({checked:'source tree (no external registry)',findingCount:findings.length,findings},null,2));
if(findings.length)process.exitCode=1;
