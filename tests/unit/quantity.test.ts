import test from 'node:test';import {strict as assert} from 'node:assert';
import {parseQuantity,formatQuantity,multiplyPriceByQuantity} from '../../packages/domain/src/shared/quantity';
test('exact quantity parsing, serialization and cents multiplication',()=>{
 assert.equal(parseQuantity('1.125'),1125n);assert.equal(formatQuantity(-375n),'-0.375');
 assert.equal(multiplyPriceByQuantity(1999n,parseQuantity('1.125')),2249n);
 assert.equal(multiplyPriceByQuantity(1n,parseQuantity('0.500')),1n);
 for(const bad of ['1.00001','1e4','NaN','-1',' 2','01','1.'])assert.throws(()=>parseQuantity(bad));
 assert.throws(()=>multiplyPriceByQuantity(100n,-1n));
});
