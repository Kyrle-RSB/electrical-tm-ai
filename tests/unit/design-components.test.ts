import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {compareSortValues,nextSort,nextTabIndex,sortRows} from '../../apps/desktop/src/renderer/components/ui/interaction';
import {displayMoney,formatShortcut,groupDigits,normalizeMoneyInput} from '../../apps/desktop/src/renderer/components/ui/format';
import {parseAppearancePreference,readAppearancePreference,resolveAppearance,writeAppearancePreference,APPEARANCE_STORAGE_KEY} from '../../apps/desktop/src/renderer/theme/system-theme';
import {formatMoney,parseMoney} from '../../packages/domain/src/shared/money';

test('a table header sorts ascending first, then flips',()=>{
 assert.deepEqual(nextSort(null,'amount'),{key:'amount',direction:'ascending'});
 assert.deepEqual(nextSort({key:'amount',direction:'ascending'},'amount'),{key:'amount',direction:'descending'});
 assert.deepEqual(nextSort({key:'amount',direction:'descending'},'amount'),{key:'amount',direction:'ascending'});
 assert.deepEqual(nextSort({key:'amount',direction:'descending'},'customer'),{key:'customer',direction:'ascending'});
});

test('sorting is numeric-aware, stable, and keeps empty values last',()=>{
 const rows=[{id:'a',v:'980.00'},{id:'b',v:'4860.00'},{id:'c',v:''},{id:'d',v:'1284.50'},{id:'e',v:'980.00'}];
 assert.deepEqual(sortRows(rows,r=>r.v,'ascending').map(r=>r.id),['a','e','d','b','c']);
 assert.deepEqual(sortRows(rows,r=>r.v,'descending').map(r=>r.id),['b','d','a','e','c']);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c','d','e'],'input is not mutated');
 assert.deepEqual(sortRows(['INV-1010','INV-102','inv-1009'],r=>r,'ascending'),['INV-102','inv-1009','INV-1010']);
 assert.equal(compareSortValues(10n,9n),1);
 assert.equal(compareSortValues(2,10),-8);
 assert.equal(compareSortValues(null,1),1);
 assert.equal(compareSortValues(undefined,null),0);
});

test('tab keys move, wrap and jump; other keys do nothing',()=>{
 assert.equal(nextTabIndex(0,3,'ArrowRight'),1);
 assert.equal(nextTabIndex(2,3,'ArrowRight'),0);
 assert.equal(nextTabIndex(0,3,'ArrowLeft'),2);
 assert.equal(nextTabIndex(1,3,'Home'),0);
 assert.equal(nextTabIndex(1,3,'End'),2);
 assert.equal(nextTabIndex(1,3,'a'),null);
 assert.equal(nextTabIndex(0,0,'ArrowRight'),null);
});

test('money display only regroups the domain text, exactly',()=>{
 assert.equal(displayMoney('1234.50'),'$1,234.50');
 assert.equal(displayMoney('-1234567.05'),'-$1,234,567.05');
 assert.equal(displayMoney('0.00'),'$0.00');
 assert.equal(displayMoney('999.99'),'$999.99');
 for(const bad of ['1234.5','1,234.50','12.345','abc','01.00'])assert.throws(()=>displayMoney(bad));
 // Round trip with the domain: cents to domain text to display, no floats anywhere.
 for(const cents of [0n,5n,99n,100n,123456789n,-250n])assert.equal(displayMoney(formatMoney(cents)).replace(/[$,]/g,''),formatMoney(cents));
 assert.equal(groupDigits('1000000'),'1,000,000');
 assert.throws(()=>groupDigits('12a'));
});

test('typed money is tidied into text the domain parser accepts, or refused',()=>{
 const cases:[string,string|null][]=[['$1,284.5','1284.5'],[' 12 ','12'],['-$3.10','-3.10'],['-3.10','-3.10'],['0.99','0.99'],
  ['12.345',null],['1e3',null],['',null],['$',null],['01.00',null],['12.',null],['abc',null]];
 for(const [input,expected] of cases){
  assert.equal(normalizeMoneyInput(input),expected,input);
  if(expected!==null)assert.doesNotThrow(()=>parseMoney(expected),input);
 }
});

test('keyboard hints use the right modifier and spoken words per platform',()=>{
 assert.deepEqual(formatShortcut(['Mod','K'],'mac'),{keys:['⌘','K'],spoken:'Command K'});
 assert.deepEqual(formatShortcut(['Mod','K'],'other'),{keys:['Ctrl','K'],spoken:'Control K'});
 assert.deepEqual(formatShortcut(['Shift','Mod','t'],'other'),{keys:['Shift','Ctrl','T'],spoken:'Shift Control T'});
 assert.equal(formatShortcut(['Escape'],'mac').spoken,'Escape');
});

test('appearance follows the system unless Light or Dark is chosen, and survives bad storage',()=>{
 assert.equal(parseAppearancePreference('dark'),'dark');
 assert.equal(parseAppearancePreference('light'),'light');
 for(const raw of [null,undefined,'','Dark','auto',1])assert.equal(parseAppearancePreference(raw),'system');
 assert.equal(resolveAppearance('system','dark'),'dark');
 assert.equal(resolveAppearance('system','light'),'light');
 assert.equal(resolveAppearance('light','dark'),'light');
 assert.equal(resolveAppearance('dark','light'),'dark');
 const data=new Map<string,string>();
 const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
 assert.equal(readAppearancePreference(storage),'system');
 writeAppearancePreference('dark',storage);assert.equal(data.get(APPEARANCE_STORAGE_KEY),'dark');assert.equal(readAppearancePreference(storage),'dark');
 writeAppearancePreference('system',storage);assert.equal(data.has(APPEARANCE_STORAGE_KEY),false);
 const broken={getItem:()=>{throw new Error('denied');},setItem:()=>{throw new Error('denied');},removeItem:()=>{throw new Error('denied');}};
 assert.equal(readAppearancePreference(broken),'system');
 assert.doesNotThrow(()=>writeAppearancePreference('light',broken));
 assert.equal(readAppearancePreference(null),'system');
});
