import {useId,type InputHTMLAttributes,type ReactNode,type SelectHTMLAttributes,type TextareaHTMLAttributes} from 'react';
import {Icon} from './Icon';

type Common={label:string;hint?:ReactNode;error?:ReactNode;optional?:boolean;className?:string};
type ControlProps={'aria-describedby'?:string;'aria-invalid'?:true};

/** Label wraps its control, so the label text is always the control's name.
 * The label text is the label's first child; hint and error sit below and are
 * linked with aria-describedby. */
function FieldShell({label,hint,error,optional,className='',children}:Common&{children:(props:ControlProps)=>ReactNode}){
 const id=useId();
 const hintId=hint?id+'-hint':undefined,errorId=error?id+'-error':undefined;
 const describedBy=[errorId,hintId].filter(Boolean).join(' ')||undefined;
 return <div className={`tm-field ${className}`.trim()}>
  <label className="tm-field__wrap"><span className="tm-field__label">{label}</span>
   {optional&&<span className="tm-field__optional">Optional</span>}
   {children({'aria-describedby':describedBy,...(error?{'aria-invalid':true as const}:{})})}
  </label>
  {hint&&<p id={hintId} className="tm-field__hint">{hint}</p>}
  {error&&<p id={errorId} className="tm-field__error"><Icon name="alert" size={14}/><span>{error}</span></p>}
 </div>;
}

type InputProps=Omit<InputHTMLAttributes<HTMLInputElement>,'className'|'type'>;
export function TextField({label,hint,error,optional,className,type='text',...input}:Common&InputProps&{type?:'text'|'email'|'tel'|'search'|'url'}){
 return <FieldShell {...{label,hint,error,optional,className}}>{a=><input className="tm-input" type={type} {...a} {...input}/>}</FieldShell>;
}

/** Decimal entry as text (no browser spinners or locale guessing), right aligned with
 * tabular figures. The caller turns the text into a quantity through the domain. */
export function NumberField({label,hint,error,optional,className,suffix,...input}:Common&InputProps&{suffix?:string}){
 return <FieldShell {...{label,hint,error,optional,className}}>{a=><span className={`tm-affix${suffix?' tm-affix--end':''}`}>
  <input className="tm-input tm-input--numeric" type="text" inputMode="decimal" autoComplete="off" {...a} {...input}/>
  {suffix&&<span className="tm-affix__end" aria-hidden="true">{suffix}</span>}
 </span>}</FieldShell>;
}

/** Money entry. The field only shows and collects text; packages/domain parses it into
 * integer cents at the boundary. normalizeMoneyInput in format.ts tidies what was typed. */
export function MoneyField({label,hint,error,optional,className,currency='$',...input}:Common&InputProps&{currency?:string}){
 return <FieldShell {...{label,hint,error,optional,className}}>{a=><span className="tm-affix tm-affix--start">
  <span className="tm-affix__start" aria-hidden="true">{currency}</span>
  <input className="tm-input tm-input--numeric" type="text" inputMode="decimal" autoComplete="off" {...a} {...input}/>
 </span>}</FieldShell>;
}

export function DateField({label,hint,error,optional,className,...input}:Common&InputProps){
 return <FieldShell {...{label,hint,error,optional,className}}>{a=><input className="tm-input tm-input--date" type="date" {...a} {...input}/>}</FieldShell>;
}

export function TextArea({label,hint,error,optional,className,...input}:Common&Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,'className'>){
 return <FieldShell {...{label,hint,error,optional,className}}>{a=><textarea className="tm-input tm-textarea" {...a} {...input}/>}</FieldShell>;
}

export type SelectOption={value:string;label:string;disabled?:boolean};
export function SelectField({label,hint,error,optional,className,options,placeholder,...select}:Common&Omit<SelectHTMLAttributes<HTMLSelectElement>,'className'>&{options:readonly SelectOption[];placeholder?:string}){
 return <FieldShell {...{label,hint,error,optional,className}}>{a=><span className="tm-select">
  <select className="tm-input" {...a} {...select}>
   {placeholder!==undefined&&<option value="" disabled>{placeholder}</option>}
   {options.map(o=><option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
  </select>
 </span>}</FieldShell>;
}
