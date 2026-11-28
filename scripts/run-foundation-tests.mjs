/** Cross-platform foundation test runner. Never rely on shell glob expansion. */
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'dist-probe','tests');
// The foundation tsconfig excludes JSX and Electron-dependent modules. Parse the
// full desktop tree too, so a syntax regression cannot pass this local gate.
function checkDesktopSyntax(folder){
  let count=0;
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
    const full=path.join(folder,entry.name);
    if(entry.isDirectory())count+=checkDesktopSyntax(full);
    else if(entry.isFile()&&/\.tsx?$/.test(entry.name)){
      const source=ts.createSourceFile(full,fs.readFileSync(full,'utf8'),ts.ScriptTarget.Latest,true);
      if(source.parseDiagnostics.length)throw new Error('Desktop syntax error: '+path.relative(root,full)+': '+source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; '));
      count++;
    }
  }
  return count;
}
const desktopSources=checkDesktopSyntax(path.join(root,'apps','desktop','src'));
if(desktopSources===0)throw new Error('Desktop syntax input missing');
console.log(`Parsed ${desktopSources} desktop TypeScript/TSX files (syntax only)`);
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
