import type {ReactNode} from 'react';
import {Card} from './ui';
/** Earlier name for a titled section; now a design-system Card labelled by its title. */
export function GlassCard({title,children,className='',id,description,actions}:{title:string;children:ReactNode;className?:string;id?:string;description?:ReactNode;actions?:ReactNode}){
 return <Card title={title} label={title} description={description} actions={actions} className={className} id={id}>{children}</Card>;
}
