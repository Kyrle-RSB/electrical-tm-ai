import {useMemo,useState,type ReactNode} from 'react';
import {Icon} from './Icon';
import {nextSort,sortRows,type SortState,type SortValue} from './interaction';

export type Column<T>={
 key:string;header:string;
 /** Numbers, money and hours: right aligned with tabular figures. */
 numeric?:boolean;
 sortValue?:(row:T)=>SortValue;
 render:(row:T)=>ReactNode;
 width?:'auto'|'narrow'|'wide';
};
type Props<T>={
 caption:string;columns:readonly Column<T>[];rows:readonly T[];rowKey:(row:T)=>string;
 loading?:boolean;loadingRows?:number;empty?:ReactNode;dense?:boolean;
 initialSort?:SortState;captionVisible?:boolean;
 footer?:ReactNode;
};
/** Sorting stays in the table; the caller passes rows in their natural order. */
export function Table<T>({caption,columns,rows,rowKey,loading=false,loadingRows=4,empty,dense=false,initialSort=null,captionVisible=false,footer}:Props<T>){
 const [sort,setSort]=useState<SortState>(initialSort);
 const sorted=useMemo(()=>{
  const column=sort&&columns.find(c=>c.key===sort.key);
  return column?.sortValue&&sort?sortRows(rows,column.sortValue,sort.direction):rows;
 },[rows,columns,sort]);
 return <div className="tm-table-wrap">
  <table className={`tm-table${dense?' tm-table--dense':''}`} aria-busy={loading||undefined}>
   <caption className={captionVisible?'tm-table__caption':'tm-visually-hidden'}>{caption}</caption>
   <thead><tr>{columns.map(c=>{
    const active=sort?.key===c.key;
    return <th key={c.key} scope="col" className={[c.numeric?'tm-cell--numeric':'',c.width?`tm-cell--${c.width}`:''].filter(Boolean).join(' ')||undefined}
     aria-sort={c.sortValue?(active&&sort?sort.direction:'none'):undefined}>
     {c.sortValue?<button type="button" className="tm-sort" onClick={()=>setSort(s=>nextSort(s,c.key))}>
      <span>{c.header}</span><Icon name={active&&sort?(sort.direction==='ascending'?'sortAsc':'sortDesc'):'sortNone'} size={14} className={active?'tm-sort__icon is-active':'tm-sort__icon'}/>
     </button>:c.header}
    </th>;})}</tr></thead>
   <tbody>
    {loading?Array.from({length:loadingRows},(_,i)=><tr key={'loading-'+i} className="tm-table__loading">{columns.map(c=>
     <td key={c.key} className={c.numeric?'tm-cell--numeric':undefined}><span className={`tm-skeleton tm-skeleton--${(i+columns.indexOf(c))%3}`}/></td>)}</tr>)
    :sorted.length===0?<tr><td className="tm-table__empty" colSpan={columns.length}>{empty??'Nothing to show yet.'}</td></tr>
    :sorted.map(row=><tr key={rowKey(row)}>{columns.map(c=><td key={c.key} className={c.numeric?'tm-cell--numeric':undefined}>{c.render(row)}</td>)}</tr>)}
   </tbody>
   {footer&&!loading&&sorted.length>0&&<tfoot>{footer}</tfoot>}
  </table>
  {loading&&<span className="tm-visually-hidden" role="status">Loading {caption}</span>}
 </div>;
}
