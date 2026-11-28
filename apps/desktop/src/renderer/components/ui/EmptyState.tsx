import type {ReactNode} from 'react';
import {Icon,type IconName} from './Icon';
export function EmptyState({icon='inbox',title,children,actions,compact=false}:{icon?:IconName;title:string;children?:ReactNode;actions?:ReactNode;compact?:boolean}){
 return <div className={`tm-empty${compact?' tm-empty--compact':''}`}>
  <span className="tm-empty__icon"><Icon name={icon} size={compact?18:22}/></span>
  <p className="tm-empty__title">{title}</p>
  {children&&<div className="tm-empty__body">{children}</div>}
  {actions&&<div className="tm-empty__actions">{actions}</div>}
 </div>;
}
