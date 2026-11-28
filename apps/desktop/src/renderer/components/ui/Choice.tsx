import {useId,type InputHTMLAttributes,type ReactNode} from 'react';
import {Icon,type IconName} from './Icon';
type BoxProps=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'className'>&{label:ReactNode;description?:ReactNode;className?:string};

export function Checkbox({label,description,className='',...input}:BoxProps){
 const id=useId();
 return <label className={`tm-check ${className}`.trim()}>
  <input type="checkbox" className="tm-check__box" aria-describedby={description?id:undefined} {...input}/>
  <span className="tm-check__text"><span className="tm-check__label">{label}</span>{description&&<span id={id} className="tm-check__description">{description}</span>}</span>
 </label>;
}

/** An on/off setting that takes effect at once. Space toggles it, as for a checkbox. */
export function Switch({label,description,className='',...input}:BoxProps){
 const id=useId();
 return <label className={`tm-check tm-check--switch ${className}`.trim()}>
  <span className="tm-check__text"><span className="tm-check__label">{label}</span>{description&&<span id={id} className="tm-check__description">{description}</span>}</span>
  <input type="checkbox" role="switch" className="tm-switch" aria-describedby={description?id:undefined} {...input}/>
 </label>;
}

export type SegmentOption<V extends string>={value:V;label:string;icon?:IconName};
/** A small radio group drawn as one control, for two to four short choices. */
export function SegmentedControl<V extends string>({legend,options,value,onChange,name}:{legend:string;options:readonly SegmentOption<V>[];value:V;onChange:(value:V)=>void;name?:string}){
 const fallback=useId();
 return <fieldset className="tm-segmented">
  <legend className="tm-visually-hidden">{legend}</legend>
  {options.map(o=><label key={o.value} className="tm-segmented__item">
   <input type="radio" className="tm-segmented__input" name={name??fallback} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)}/>
   <span className="tm-segmented__label">{o.icon&&<Icon name={o.icon} size={14}/>}{o.label}</span>
  </label>)}
 </fieldset>;
}
