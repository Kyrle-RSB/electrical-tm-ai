import type {ReactNode} from 'react';
type CardProps={title?:ReactNode;description?:ReactNode;actions?:ReactNode;footer?:ReactNode;children?:ReactNode;className?:string;id?:string;
 /** Heading id, so a section can be labelled by its title. */
 titleId?:string;headingLevel?:2|3;as?:'section'|'div';label?:string};
export function Card({title,description,actions,footer,children,className='',id,titleId,headingLevel=2,as='section',label}:CardProps){
 const Tag=as,Heading=headingLevel===2?'h2':'h3';
 const labelling=titleId?{'aria-labelledby':titleId}:label?{'aria-label':label}:{};
 return <Tag className={`tm-card ${className}`.trim()} id={id} {...labelling}>
  {(title||actions)&&<header className="tm-card__header">
   <div className="tm-card__heading">{title&&<Heading className="tm-card__title" id={titleId}>{title}</Heading>}
    {description&&<p className="tm-card__description">{description}</p>}</div>
   {actions&&<div className="tm-card__actions">{actions}</div>}
  </header>}
  {children!==undefined&&<div className="tm-card__body">{children}</div>}
  {footer&&<footer className="tm-card__footer">{footer}</footer>}
 </Tag>;
}

/** A big, readable figure for money, hours and counts. value is display text. */
export function Stat({label,value,unit,hint,tone='neutral'}:{label:string;value:string;unit?:string;hint?:ReactNode;tone?:'neutral'|'accent'|'danger'|'success'}){
 return <div className={`tm-stat tm-stat--${tone}`}>
  <span className="tm-stat__label">{label}</span>
  <span className="tm-stat__value">{value}{unit&&<span className="tm-stat__unit">{unit}</span>}</span>
  {hint&&<span className="tm-stat__hint">{hint}</span>}
 </div>;
}
