import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {allocateDailyOverhead} from '../../packages/domain/src/overhead/allocation';
test('approved half-day overhead policy retains unallocated capacity',()=>{
 const a=allocateDailyOverhead(30000n,[{projectId:'A',halfDays:1}]);
 assert.deepEqual(a.allocations,[{projectId:'A',allocatedCents:15000n}]);assert.equal(a.unallocatedCents,15000n);
 assert.equal(allocateDailyOverhead(30000n,[]).unallocatedCents,30000n);
});
test('two half days fully allocate, overlapping project capacity stays unapproved',()=>{
 const a=allocateDailyOverhead(30000n,[{projectId:'A',halfDays:1},{projectId:'B',halfDays:1}]);
 assert.equal(a.unallocatedCents,0n);assert.equal(a.allocations[0].allocatedCents,15000n);
 assert.throws(()=>allocateDailyOverhead(30000n,[{projectId:'A',halfDays:2},{projectId:'B',halfDays:1}]));
 assert.throws(()=>allocateDailyOverhead(10000n,[{projectId:'A',halfDays:1},{projectId:'A',halfDays:1}]));
});
test('indivisible overhead cents are apportioned deterministically without overallocating',()=>{
 const result=allocateDailyOverhead(1n,[{projectId:'B',halfDays:1},{projectId:'A',halfDays:1}]);
 assert.equal(result.unallocatedCents,0n);
 assert.deepEqual(result.allocations,[{projectId:'B',allocatedCents:0n},{projectId:'A',allocatedCents:1n}]);
 const same=allocateDailyOverhead(1n,[{projectId:'A',halfDays:1},{projectId:'B',halfDays:1}]);
 assert.equal(same.allocations[0].allocatedCents,1n);
});
test('one half-day consumes half-day overhead and preserves the unallocated remainder',()=>{
 const example=allocateDailyOverhead(30000n,[{projectId:'P',halfDays:1}]);
 assert.equal(example.allocations[0].allocatedCents,15000n);assert.equal(example.unallocatedCents,15000n);
 const odd=allocateDailyOverhead(101n,[{projectId:'P',halfDays:1}]);
 assert.equal(odd.allocations[0].allocatedCents,51n);assert.equal(odd.unallocatedCents,50n);
});
