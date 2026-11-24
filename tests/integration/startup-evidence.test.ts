import test from 'node:test';import {strict as assert} from 'node:assert';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStartupRecorder} from '../../apps/desktop/src/main/bootstrap';
test('startup receipt records safe identifiers only and avoids arbitrary data leakage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forkb-startup-'));
 try{
  const log=createStartupRecorder(dir);log.record('renderer.load','begin');log.record('renderer.load','pass');
  const lines=fs.readFileSync(log.file,'utf8').trim().split('\n').map(s=>JSON.parse(s));
  assert.deepEqual(lines.map(x=>[x.event,x.state]),[['renderer.load','begin'],['renderer.load','pass']]);
  assert.throws(()=>log.record('SECRET: abc','info'),/Invalid/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
