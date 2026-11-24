import test from 'node:test';import {strict as assert} from 'node:assert';
import {LocalOperationQueue} from '../../packages/application/src/use-cases/backup-restore';
test('serialized data operations prevent a backup snapshot from interleaving with writes',async()=>{
 const queue=new LocalOperationQueue(),events:string[]=[];
 let release!:()=>void;
 const hold=new Promise<void>(resolve=>{release=resolve});
 const write=queue.run(async()=>{events.push('write-begin');await hold;events.push('write-commit')});
 const backup=queue.run(()=>{events.push('backup-start');return [...events]});
 const next=queue.run(()=>{events.push('next-write');return events.length});
 await Promise.resolve();release();
 assert.deepEqual(await backup,['write-begin','write-commit','backup-start']);
 await Promise.all([write,next]);
 assert.deepEqual(events,['write-begin','write-commit','backup-start','next-write']);
});
test('a failed operation does not poison the queue; shutdown refuses new work',async()=>{
 const q=new LocalOperationQueue();await assert.rejects(q.run(()=>{throw new Error('broken')}),/broken/);
 assert.equal(await q.run(()=>7),7);await q.drain();
 await assert.rejects(q.run(()=>8),/shutting down/);
});
