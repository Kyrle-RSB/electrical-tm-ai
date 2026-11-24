import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseMoney,formatMoney,multiplyDecimal,markedUp,roundRatio} from '../../packages/domain/src/shared/money';
test('currency parsing is exact, denies unsafe floats and formats correctly',()=>{
 assert.equal(parseMoney('100.05'),10005n);assert.equal(formatMoney(-1n),'-0.01');
 for(const bad of ['12.345','1e3','NaN','1,000','1.','01.22'])assert.throws(()=>parseMoney(bad));
});
test('markup, fractional quantities and negative rounding are deterministic',()=>{
 assert.equal(markedUp(parseMoney('10.00'),'25'),1250n);
 assert.equal(markedUp(parseMoney('10.01'),'25'),1251n);
 assert.equal(multiplyDecimal(1001n,'0.5'),501n);
 assert.equal(roundRatio(-1001n,2n),-501n);
 assert.throws(()=>multiplyDecimal(100n,'0.12345'));
});

import {assertSqliteCents} from '../../packages/domain/src/shared/money';
test('SQLite money storage refuses overflow while exact BigInt arithmetic remains available',()=>{
 assert.equal(assertSqliteCents(2n**63n-1n),2n**63n-1n);
 assert.throws(()=>assertSqliteCents(2n**63n),/storage range/);
 assert.throws(()=>assertSqliteCents(-(2n**63n)-1n),/storage range/);
});
