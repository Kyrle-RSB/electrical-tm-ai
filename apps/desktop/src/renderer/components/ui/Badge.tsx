import type {ReactNode} from 'react';
import {Icon} from './Icon';
import type {Status} from '../../theme/tokens';
export type BadgeTone='neutral'|'accent'|'info'|'success'|'danger'|'violet'|'slate';
export function Badge({tone='neutral',children,dot=false}:{tone?:BadgeTone;children:ReactNode;dot?:boolean}){
 return <span className={`tm-badge tm-badge--${tone}`}>{dot&&<span className="tm-badge__dot" aria-hidden="true"/>}{children}</span>;
}
const statusLabels:Record<Status,string>={draft:'Draft',sent:'Sent',paid:'Paid',overdue:'Overdue',signed:'Signed',locked:'Locked'};
/** The one way to show a document's state. Colour is never the only signal: the word is always there. */
export function StatusBadge({status,children}:{status:Status;children?:ReactNode}){
 return <span className={`tm-badge tm-badge--status tm-status--${status}`}>
  {status==='locked'?<Icon name="lock" size={12}/>:status==='signed'?<Icon name="check" size={12}/>:<span className="tm-badge__dot" aria-hidden="true"/>}
  {children??statusLabels[status]}
 </span>;
}
