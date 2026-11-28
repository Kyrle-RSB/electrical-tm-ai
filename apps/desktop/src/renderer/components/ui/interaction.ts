/** Pure rules behind the table and tabs, kept apart from React so they are unit tested. */
export type SortDirection='ascending'|'descending';
export type SortState={key:string;direction:SortDirection}|null;
export type SortValue=string|number|bigint|null|undefined;

/** A new column sorts ascending; the same column again flips the direction. */
export function nextSort(current:SortState,key:string):SortState{
 if(!current||current.key!==key)return {key,direction:'ascending'};
 return {key,direction:current.direction==='ascending'?'descending':'ascending'};
}

const collator=new Intl.Collator('en-CA',{numeric:true,sensitivity:'base'});
/** Empty values always sort last, whatever the direction. */
export function compareSortValues(a:SortValue,b:SortValue):number{
 const emptyA=a===null||a===undefined||a==='',emptyB=b===null||b===undefined||b==='';
 if(emptyA||emptyB)return emptyA===emptyB?0:emptyA?1:-1;
 if(typeof a==='string'&&typeof b==='string')return collator.compare(a,b);
 if(typeof a==='bigint'&&typeof b==='bigint')return a<b?-1:a>b?1:0;
 if(typeof a==='number'&&typeof b==='number')return a-b;
 return collator.compare(String(a),String(b));
}

/** Stable: rows with equal values keep their original order. Returns a new array. */
export function sortRows<T>(rows:readonly T[],value:(row:T)=>SortValue,direction:SortDirection):T[]{
 const sign=direction==='ascending'?1:-1;
 return rows.map((row,index)=>({row,index,v:value(row)})).sort((x,y)=>{
  const emptyX=x.v===null||x.v===undefined||x.v==='',emptyY=y.v===null||y.v===undefined||y.v==='';
  const c=emptyX||emptyY?compareSortValues(x.v,y.v):sign*compareSortValues(x.v,y.v);
  return c||x.index-y.index;
 }).map(x=>x.row);
}

/** Arrow keys move along a tab list and wrap; Home and End jump to the ends. */
export function nextTabIndex(current:number,count:number,key:string):number|null{
 if(count<1)return null;
 switch(key){
  case 'ArrowRight':case 'ArrowDown':return (current+1)%count;
  case 'ArrowLeft':case 'ArrowUp':return (current-1+count)%count;
  case 'Home':return 0;
  case 'End':return count-1;
  default:return null;
 }
}
