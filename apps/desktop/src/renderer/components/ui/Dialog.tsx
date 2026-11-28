import {useEffect,useId,useRef,type ReactNode} from 'react';
import {Button} from './Button';
/** A modal on the native <dialog>: the browser traps focus, makes the page behind it
 * inert, closes on Escape and returns focus to the control that opened it.
 * Focus starts on an element marked data-autofocus, else the first field, else the first footer button. */
export function Dialog({open,onClose,title,description,children,footer,size='md',className=''}:{open:boolean;onClose:()=>void;title:string;description?:ReactNode;children?:ReactNode;footer?:ReactNode;size?:'sm'|'md'|'lg';className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 const id=useId();
 useEffect(()=>{
  const dialog=ref.current;if(!dialog)return;
  if(open&&!dialog.open){
   dialog.showModal();
   // Start in the form if there is one, otherwise on the first footer action (usually Cancel).
   const pick=(selector:string)=>dialog.querySelector<HTMLElement>(selector);
   (pick('[data-autofocus]')??pick('.tm-dialog__body :is(input,select,textarea,button):not(:disabled)')??pick('.tm-dialog__footer button:not(:disabled)'))?.focus();
  }
  if(!open&&dialog.open)dialog.close();
 },[open]);
 useEffect(()=>{
  const dialog=ref.current;if(!dialog)return;
  const closed=()=>onClose();
  dialog.addEventListener('close',closed);
  return()=>dialog.removeEventListener('close',closed);
 },[onClose]);
 return <dialog ref={ref} className={`tm-dialog tm-dialog--${size} ${className}`.trim()} aria-labelledby={id+'-title'} aria-describedby={description?id+'-description':undefined}>
  {open&&<>
   <header className="tm-dialog__header">
    <h2 className="tm-dialog__title" id={id+'-title'}>{title}</h2>
    <Button variant="ghost" size="sm" icon="x" iconOnly onClick={onClose}>Close</Button>
   </header>
   {description&&<p className="tm-dialog__description" id={id+'-description'}>{description}</p>}
   {children&&<div className="tm-dialog__body">{children}</div>}
   {footer&&<footer className="tm-dialog__footer">{footer}</footer>}
  </>}
 </dialog>;
}
