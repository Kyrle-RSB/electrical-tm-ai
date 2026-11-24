import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {estimatedProfit} from '../../packages/domain/src/profitability/estimated-profit';
test('estimated profit includes burdened labor cost, material spread and overhead',()=>{
 const a=estimatedProfit({materialCostCents:50000n,materialSellCents:70000n,
 laborBillCents:90000n,fullyBurdenedLaborCostCents:65000n,allocatedOverheadCents:15000n});
 assert.deepEqual(a,{materialSpreadCents:20000n,laborSpreadCents:25000n,estimatedProfitCents:30000n});
});
