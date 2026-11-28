import {cloneElement,useEffect,useId,useRef,useState,type ReactElement} from 'react';
/** A short label for a control, shown on hover (after a short delay) and on keyboard focus.
 * Escape hides it. Never put anything the person must read or click inside a tooltip. */
export function Tooltip({content,children,placement='top'}:{content:string;children:ReactElement<{'aria-describedby'?:string}>;placement?:'top'|'bottom'}){
 const id=useId();
 const [open,setOpen]=useState(false);
 const timer=useRef<number|undefined>(undefined);
 const clear=()=>{if(timer.current!==undefined){window.clearTimeout(timer.current);timer.current=undefined;}};
 useEffect(()=>()=>clear(),[]);
 useEffect(()=>{
  if(!open)return;
  const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[open]);
 const describedBy=[children.props['aria-describedby'],id].filter(Boolean).join(' ');
 return <span className="tm-tooltip-wrap"
  onPointerEnter={()=>{clear();timer.current=window.setTimeout(()=>setOpen(true),350);}}
  onPointerLeave={()=>{clear();setOpen(false);}}
  onFocus={event=>{if((event.target as HTMLElement).matches(':focus-visible'))setOpen(true);}}
  onBlur={()=>{clear();setOpen(false);}}>
  {cloneElement(children,{'aria-describedby':describedBy})}
  <span role="tooltip" id={id} className={`tm-tooltip tm-tooltip--${placement}${open?' is-open':''}`}>{content}</span>
 </span>;
}
