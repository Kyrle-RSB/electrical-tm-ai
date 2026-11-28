import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Icon,type IconName} from './Icon';
import {Button} from './Button';
export type ToastTone='info'|'success'|'warning'|'danger';
export type ToastInput={title:string;body?:string;tone?:ToastTone;durationMs?:number};
type ToastItem=Required<Omit<ToastInput,'body'>>&{id:number;body?:string};
const icons:Record<ToastTone,IconName>={info:'info',success:'check',warning:'alert',danger:'alert'};
const ToastContext=createContext<((toast:ToastInput)=>void)|null>(null);

/** Short confirmations after an action. Anything the person must act on belongs in the
 * screen or a dialog, not a toast. Errors stay until closed. */
export function ToastProvider({children}:{children:ReactNode}){
 const [items,setItems]=useState<ToastItem[]>([]);
 const next=useRef(1);
 const dismiss=useCallback((id:number)=>setItems(list=>list.filter(t=>t.id!==id)),[]);
 const show=useCallback((toast:ToastInput)=>{
  const tone=toast.tone??'info';
  const item:ToastItem={id:next.current++,title:toast.title,body:toast.body,tone,durationMs:toast.durationMs??(tone==='danger'?0:5000)};
  setItems(list=>[...list.slice(-3),item]);
 },[]);
 const value=useMemo(()=>show,[show]);
 return <ToastContext.Provider value={value}>{children}
  <div className="tm-toast-region" aria-live="polite" aria-relevant="additions" aria-label="Notifications" role="region">
   {items.map(t=><ToastView key={t.id} toast={t} onDismiss={dismiss}/>)}
  </div>
 </ToastContext.Provider>;
}
function ToastView({toast,onDismiss}:{toast:ToastItem;onDismiss:(id:number)=>void}){
 const [paused,setPaused]=useState(false);
 useEffect(()=>{
  if(!toast.durationMs||paused)return;
  const timer=window.setTimeout(()=>onDismiss(toast.id),toast.durationMs);
  return()=>window.clearTimeout(timer);
 },[toast,paused,onDismiss]);
 return <div className={`tm-toast tm-toast--${toast.tone}`} role={toast.tone==='danger'?'alert':'status'}
  onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={()=>setPaused(false)}>
  <span className="tm-toast__icon"><Icon name={icons[toast.tone]}/></span>
  <div className="tm-toast__content"><p className="tm-toast__title">{toast.title}</p>{toast.body&&<p className="tm-toast__body">{toast.body}</p>}</div>
  <Button variant="ghost" size="sm" icon="x" iconOnly onClick={()=>onDismiss(toast.id)}>Dismiss notification</Button>
 </div>;
}
export function useToast():(toast:ToastInput)=>void{
 const value=useContext(ToastContext);
 if(!value)throw new Error('useToast needs ToastProvider');
 return value;
}
