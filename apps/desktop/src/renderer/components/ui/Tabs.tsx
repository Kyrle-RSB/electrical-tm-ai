import {useId,useRef,type KeyboardEvent,type ReactNode} from 'react';
import {nextTabIndex} from './interaction';
export type TabItem<V extends string>={value:V;label:string;count?:number;content:ReactNode};
/** WAI-ARIA tabs: one tab stop, arrow keys move and select, Home and End jump. */
export function Tabs<V extends string>({label,items,value,onChange}:{label:string;items:readonly TabItem<V>[];value:V;onChange:(value:V)=>void}){
 const id=useId();
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 const index=Math.max(0,items.findIndex(t=>t.value===value));
 const keyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
  const next=nextTabIndex(index,items.length,event.key);
  if(next===null)return;
  event.preventDefault();onChange(items[next].value);refs.current[next]?.focus();
 };
 return <div className="tm-tabs">
  <div className="tm-tabs__list" role="tablist" aria-label={label}>
   {items.map((t,i)=><button key={t.value} ref={el=>{refs.current[i]=el;}} type="button" role="tab" id={`${id}-tab-${t.value}`}
    aria-selected={i===index} aria-controls={`${id}-panel-${t.value}`} tabIndex={i===index?0:-1}
    className="tm-tabs__tab" onClick={()=>onChange(t.value)} onKeyDown={keyDown}>
    {t.label}{t.count!==undefined&&<span className="tm-tabs__count">{t.count}</span>}
   </button>)}
  </div>
  {items.map((t,i)=><div key={t.value} role="tabpanel" id={`${id}-panel-${t.value}`} aria-labelledby={`${id}-tab-${t.value}`} hidden={i!==index} tabIndex={0} className="tm-tabs__panel">
   {i===index&&t.content}
  </div>)}
 </div>;
}
