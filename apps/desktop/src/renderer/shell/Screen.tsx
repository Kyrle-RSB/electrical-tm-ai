import type {ReactNode} from 'react';
import {Badge,Button,Card,EmptyState,Icon,Kbd} from '../components/ui';
import {routeDefinition,type RouteId} from './routes';
import {useOpenPalette} from './AppShell';

/** One screen inside the shell: a heading the shell can move focus to, the screen's
 * one-line summary, optional header actions, then the content. Hidden, not unmounted,
 * when the screen keeps drafts that must survive a trip to another screen. */
export function Screen({id,active,actions,children}:{id:RouteId;active:boolean;actions?:ReactNode;children:ReactNode}){
 const route=routeDefinition(id);
 const titleId=`screen-${id}-title`;
 return <section className="screen" data-screen={id} hidden={!active} aria-labelledby={titleId}>
  <header className="screen__header">
   <div className="screen__heading"><h1 id={titleId} tabIndex={-1}>{route.label}</h1><p className="screen__summary">{route.summary}</p></div>
   {actions&&<div className="screen__actions">{actions}</div>}
  </header>
  {children}
 </section>;
}

/** A screen that is not built yet: says what is coming, never a blank page. */
export function ComingSoonScreen({id,onNavigate}:{id:RouteId;onNavigate:(route:RouteId)=>void}){
 const openPalette=useOpenPalette();
 const route=routeDefinition(id);
 const coming=route.coming;
 if(!coming)throw new Error('Screen is built; no coming-soon state');
 return <Screen id={id} active actions={<Badge tone="info" dot>Coming soon</Badge>}>
  <Card as="div" className="coming">
   <EmptyState icon={route.icon} title={coming.title}
    actions={<>
     <Button variant="primary" icon="arrowRight" onClick={()=>onNavigate(coming.next.route)}>{coming.next.label}</Button>
     <Button variant="ghost" icon="search" onClick={openPalette}>Open command palette</Button>
    </>}>
    <p className="coming__body">{coming.body}</p>
    <ul className="coming__points" aria-label="Planned for this screen">{coming.points.map(point=><li key={point}><Icon name="check" size={14}/><span>{point}</span></li>)}</ul>
    <p className="coming__hint">Press <Kbd keys={['Mod','K']}/> anywhere to jump to a screen or run an action.</p>
   </EmptyState>
  </Card>
 </Screen>;
}
