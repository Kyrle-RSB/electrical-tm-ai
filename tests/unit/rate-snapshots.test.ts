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

test('labor snapshots reject missing burden, negative inputs, ambiguous versions and amounts outside signed SQLite range',()=>{
 const base=rates[0];
 const run=(candidate:typeof base,hours='1')=>snapshotLaborRate([candidate],base.workerId,'2026-11-02',hours);
 assert.throws(()=>run({...base,fullyBurdenedCostHour:''}));
 assert.throws(()=>run({...base,fullyBurdenedCostHour:'-1.00'}));
 assert.throws(()=>run(base,'-1'));
 assert.throws(()=>snapshotLaborRate([base,{...base,id:'duplicate'}],base.workerId,'2026-11-02','1'),/Ambiguous/);
 assert.throws(()=>run({...base,billHour:'92233720368547758.08'}),/storage range/);
 assert.throws(()=>run({...base,billHour:'92233720368547758.07'},'2'),/storage range/);
 assert.throws(()=>run({...base,fullyBurdenedCostHour:'92233720368547758.07'},'2'),/storage range/);
});
