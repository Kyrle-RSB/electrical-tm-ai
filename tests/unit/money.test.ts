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

test('material markup snapshots preserve exact cost, sell, spread and checked storage bounds',async()=>{
 const {materialMarkupSnapshot}=await import('../../packages/domain/src/materials/markup');
 assert.deepEqual(materialMarkupSnapshot(1001n,'25'),{netUnitCostCents:1001n,markupPercent:'25',sellUnitCents:1251n,estimatedSpreadCents:250n});
 assert.throws(()=>materialMarkupSnapshot(-1n,'25'),/Invalid supplier/);
 assert.throws(()=>materialMarkupSnapshot(2n**63n-1n,'1'),/storage range/);
});

import {extendSourceUnitPriceCents as extendSourcePrice,percentageOfCents} from '../../packages/domain/src/shared/money';
import {parseQuantity} from '../../packages/domain/src/shared/quantity';
const rounding = 'HALF_AWAY_FROM_ZERO' as const;

test('fractional source price stays exact until the explicit extended cents boundary',()=>{
 // Independent decimal oracles: 13.3375 x 2.5 = 33.34375; .005 x 3 = .015.
 assert.equal(extendSourcePrice('13.3375',parseQuantity('2.500'),rounding),3334n);
 assert.equal(extendSourcePrice('0.005',parseQuantity('3'),rounding),2n);
 assert.equal(extendSourcePrice('0.005',parseQuantity('1'),rounding),1n);
 assert.equal(extendSourcePrice('0.0049',parseQuantity('1'),rounding),0n);
 assert.equal(extendSourcePrice('0.0001',parseQuantity('1000000'),rounding),10000n);
 assert.equal(extendSourcePrice('13.3375',0n,rounding),0n);
 // Finalized money parser is deliberately unchanged, not a lossy source-price parser.
 assert.throws(()=>parseMoney('13.3375'));
});

test('explicit caller-selected taxable bases and percentage rates round exactly without tax policy assumptions',()=>{
 // Synthetic fixtures only. These rates do not assert any actual jurisdictional tax rule.
 assert.equal(percentageOfCents(3334n,'5',rounding),167n);
 assert.equal(percentageOfCents(10000n,'7.1250',rounding),713n);
 assert.equal(percentageOfCents(10n,'5',rounding),1n);
 assert.equal(percentageOfCents(-10n,'5',rounding),-1n);
 assert.equal(percentageOfCents(12345n,'0',rounding),0n);
 assert.equal(percentageOfCents(0n,'5',rounding),0n);
 // A caller must explicitly choose the stage/base; do not silently round line then subtotal.
 assert.equal(percentageOfCents(10n,'5',rounding)+percentageOfCents(10n,'5',rounding),2n);
 assert.equal(percentageOfCents(20n,'5',rounding),1n);
});

test('fractional price and percentage primitives reject invalid precision, unsupported modes and signed storage overflow',()=>{
 for(const bad of ['-1','1e-3','0.12345','NaN',' 1','01','1.']){
  assert.throws(()=>extendSourcePrice(bad,1000n,rounding),/decimal/);
  assert.throws(()=>percentageOfCents(100n,bad,rounding),/decimal/);
 }
 assert.throws(()=>extendSourcePrice('1.00',-1n,rounding),/quantity/);
 assert.throws(()=>extendSourcePrice('0.00',2n**63n,rounding),/quantity/);
 assert.throws(()=>extendSourcePrice('10000000000000000000',1n,rounding),/decimal/);
 assert.throws(()=>extendSourcePrice('1.00',1000n,'UNKNOWN' as typeof rounding),/rounding/);
 assert.throws(()=>percentageOfCents(100n,'5','UNKNOWN' as typeof rounding),/rounding/);
 assert.throws(()=>extendSourcePrice('92233720368547758.08',1000n,rounding),/storage range/);
 assert.throws(()=>percentageOfCents(2n**63n-1n,'101',rounding),/storage range/);
 assert.throws(()=>percentageOfCents(2n**63n,'0',rounding),/storage range/);
});
