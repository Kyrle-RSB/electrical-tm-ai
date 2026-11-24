import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {verifyMaterialSplit} from '../../packages/domain/src/materials/disposition-splits';
test('material quantity may split across project, truck stock and damaged',()=>{
 const x=verifyMaterialSplit('10',[
  {quantity:'6',disposition:'project',projectId:'p'},{quantity:'2.5',disposition:'stock'},
  {quantity:'1.5',disposition:'damaged',notes:'Crushed carton'}]);
 assert.deepEqual(x,{totalAllocatedMills:10000n,remainingMills:0n});
});
test('oversplits and job-without-target are rejected',()=>{
 assert.throws(()=>verifyMaterialSplit('3',[{quantity:'4',disposition:'stock'}]));
 assert.throws(()=>verifyMaterialSplit('3',[{quantity:'1',disposition:'other-project'}]));
 assert.equal(verifyMaterialSplit('3',[{quantity:'1',disposition:'stock'}]).remainingMills,2000n);
});
