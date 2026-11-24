import test from 'node:test';import {strict as assert} from 'node:assert';
import {snapshotLaborRate} from '../../packages/domain/src/labor/rate-snapshots';
const rates=[{id:'old',workerId:'w1',effectiveDay:'2026-01-01',billHour:'120.00',fullyBurdenedCostHour:'55.00'},
 {id:'new',workerId:'w1',effectiveDay:'2026-11-01',billHour:'135.00',fullyBurdenedCostHour:'65.00'}];
test('rate date snapshot and burdened cost do not retrospectively change',()=>{
 const earlier=snapshotLaborRate(rates,'w1','2026-10-01','2.50');
 assert.equal(earlier.billCents,30000n);assert.equal(earlier.costCents,13750n);assert.equal(earlier.rateId,'old');
 const later=snapshotLaborRate(rates,'w1','2026-11-02','2.00');
 assert.equal(later.estimatedLaborSpreadCents,14000n);assert.equal(later.rateId,'new');
 assert.throws(()=>snapshotLaborRate(rates,'w1','2025-01-01','1'));
 assert.throws(()=>snapshotLaborRate(rates,'w1','2026-02-31','1'),/Invalid work day/);
});

test('calendar validation avoids throwing on unrelated invalid rate dates and preserves effective snapshot',async()=>{
 const {isCalendarDay}=await import('../../packages/domain/src/shared/clock');
 assert.equal(isCalendarDay('2024-02-29'),true);assert.equal(isCalendarDay('2026-99-99'),false);
 const versions=[...rates,{...rates[0],id:'invalid',effectiveDay:'2026-99-99'}];
 assert.equal(snapshotLaborRate(versions,'w1','2026-11-02','1').rateId,'new');
});
