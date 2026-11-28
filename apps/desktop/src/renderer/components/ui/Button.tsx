import {forwardRef,type ButtonHTMLAttributes,type ReactNode} from 'react';
import {Icon,type IconName} from './Icon';
export type ButtonVariant='primary'|'secondary'|'ghost'|'danger';
export type ButtonSize='sm'|'md'|'lg';
type Props=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:ButtonVariant;size?:ButtonSize;loading?:boolean;icon?:IconName;iconOnly?:boolean;children:ReactNode};
/** The label stays in place while loading, so the button keeps its width and its name.
 * For an icon-only button pass the accessible name as children; it is visually hidden. */
export const Button=forwardRef<HTMLButtonElement,Props>(function Button({variant='secondary',size='md',loading=false,icon,iconOnly=false,className='',children,disabled,type='button',...rest},ref){
 const classes=['tm-btn',`tm-btn--${variant}`,`tm-btn--${size}`,iconOnly?'tm-btn--icon':'',loading?'is-loading':'',className].filter(Boolean).join(' ');
 return <button ref={ref} type={type} className={classes} disabled={disabled||loading} aria-busy={loading||undefined} {...rest}>
  {loading?<span className="tm-spinner" aria-hidden="true"/>:icon?<Icon name={icon}/>:null}
  <span className={iconOnly?'tm-visually-hidden':'tm-btn__label'}>{children}</span>
 </button>;
});
