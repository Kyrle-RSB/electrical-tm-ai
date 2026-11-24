/** Cross-platform foundation test runner. Never rely on shell glob expansion. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'dist-probe','tests');
function discover(folder){
  if(!fs.existsSync(folder))throw new Error(`Compiled tests missing: ${folder}`);
  const result=[];
  for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const full=path.join(folder,entry.name);
    if(entry.isDirectory())result.push(...discover(full));
    else if(entry.isFile()&&entry.name.endsWith('.test.js'))result.push(full);
  }
  return result;
}
const tests=discover(dir);
if(tests.length===0)throw new Error('No compiled foundation tests found; refusing false PASS');
console.log(`Executing ${tests.length} compiled foundation test files`);
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
