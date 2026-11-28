import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {estimatedProfit} from '../../packages/domain/src/profitability/estimated-profit';
test('estimated profit includes burdened labor cost, material spread and overhead',()=>{
 const a=estimatedProfit({materialCostCents:50000n,materialSellCents:70000n,
 laborBillCents:90000n,fullyBurdenedLaborCostCents:65000n,allocatedOverheadCents:15000n});
 assert.deepEqual(a,{materialSpreadCents:20000n,laborSpreadCents:25000n,estimatedProfitCents:30000n});
});

test('approved estimate oracle rejects incomplete, negative and overflowing inputs without rejecting genuine losses',()=>{
 const input={materialCostCents:4000n,materialSellCents:10000n,laborBillCents:50000n,fullyBurdenedLaborCostCents:26000n,allocatedOverheadCents:20000n};
 assert.deepEqual(estimatedProfit(input),{materialSpreadCents:6000n,laborSpreadCents:24000n,estimatedProfitCents:10000n});
 assert.equal(estimatedProfit({...input,allocatedOverheadCents:40000n}).estimatedProfitCents,-10000n);
 assert.throws(()=>estimatedProfit({...input,fullyBurdenedLaborCostCents:undefined} as unknown as typeof input));
 assert.throws(()=>estimatedProfit({...input,fullyBurdenedLaborCostCents:-1n}),/nonnegative/);
 assert.throws(()=>estimatedProfit({...input,materialCostCents:-1n}),/nonnegative/);
 assert.throws(()=>estimatedProfit({...input,allocatedOverheadCents:-1n}),/nonnegative/);
 assert.throws(()=>estimatedProfit({...input,materialSellCents:2n**63n}),/storage range/);
 assert.throws(()=>estimatedProfit({...input,materialSellCents:2n**63n-1n,otherRevenueCents:2n**63n-1n}),/storage range/);
});
