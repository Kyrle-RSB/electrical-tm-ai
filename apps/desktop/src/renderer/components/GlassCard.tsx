import type {ReactNode} from 'react';
export function GlassCard({title,children,className='',id}:{title:string;children:ReactNode;className?:string;id?:string}){
 return <section className={`glass ${className}`} aria-label={title} id={id}>
  <h2>{title}</h2>{children}
 </section>;
}
