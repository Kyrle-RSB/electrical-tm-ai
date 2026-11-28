/** The command palette's list and its rules, kept apart from React so they are unit
 * tested. A command is data: what it shows and an intent the shell carries out. */
import type {Platform} from '../components/ui/format';
import {ROUTES,type RouteId,type ShellIcon} from './routes';

export const ACTION_IDS=['new-project','check-health','theme-light','theme-dark','theme-system','toggle-sidebar','open-help'] as const;
export type ActionId=typeof ACTION_IDS[number];
export type CommandIntent={kind:'navigate';route:RouteId}|{kind:'action';action:ActionId}|{kind:'project';projectId:string};
export type CommandGroup='navigate'|'action'|'project';
export type Command={id:string;group:CommandGroup;label:string;detail:string;icon:ShellIcon;keywords:readonly string[];intent:CommandIntent};
export type PaletteProject={id:string;code:string;customer:string;name:string;archived:boolean};

export const GROUP_LABELS:Record<CommandGroup,string>={navigate:'Go to',action:'Actions',project:'Projects'};
const GROUP_ORDER:readonly CommandGroup[]=['navigate','action','project'];

/** Every screen, the actions that exist today, and the saved projects. */
export function buildCommands({projects,sidebarCollapsed}:{projects:readonly PaletteProject[];sidebarCollapsed:boolean}):Command[]{
 const screens:Command[]=ROUTES.map(r=>({id:'go-'+r.id,group:'navigate',label:r.id==='components'?'Components page':r.label,
  detail:r.coming?'Coming soon':'Screen',icon:r.icon,keywords:r.keywords,intent:{kind:'navigate',route:r.id}}));
 const action=(id:ActionId,label:string,detail:string,icon:ShellIcon,keywords:string[]):Command=>({id,group:'action',label,detail,icon,keywords,intent:{kind:'action',action:id}});
 const actions:Command[]=[
  action('new-project','New project','Jobs','plus',['create','add','job']),
  action('check-health','Check desktop health','Foundation tools','check',['ping','status','services']),
  action('theme-light','Use light theme','Appearance','sun',['appearance','mode','colour','color']),
  action('theme-dark','Use dark theme','Appearance','moon',['appearance','mode','colour','color','night']),
  action('theme-system','Follow system theme','Appearance','monitor',['appearance','mode','automatic','auto']),
  action('toggle-sidebar',sidebarCollapsed?'Expand sidebar':'Collapse sidebar','Layout','panelLeft',['navigation','menu','icons']),
  action('open-help','Open help','Getting started','help',['guide','getting started','support'])
 ];
 const saved:Command[]=projects.map(p=>({id:'project-'+p.id,group:'project',label:p.code,
  detail:[p.customer,p.archived?'Archived':''].filter(Boolean).join(' · '),icon:'briefcase',
  keywords:[p.customer,p.name].filter(Boolean),intent:{kind:'project',projectId:p.id}}));
 return [...screens,...actions,...saved];
}

const words=(text:string)=>text.toLowerCase().split(/\s+/).filter(Boolean);
/** Lower is better; null when the command does not match every word of the query. */
export function scoreCommand(command:Command,query:string):number|null{
 const tokens=words(query);
 if(tokens.length===0)return 0;
 const label=command.label.toLowerCase(),labelWords=words(command.label);
 const rest=[command.detail,...command.keywords,GROUP_LABELS[command.group]].join(' ').toLowerCase();
 let score=0;
 for(const t of tokens){
  if(labelWords.some(w=>w.startsWith(t)))score+=1;
  else if(label.includes(t))score+=2;
  else if(rest.includes(t))score+=4;
  else return null;
 }
 return label.startsWith(query.trim().toLowerCase())?score-1:score;
}

export type CommandResults={groups:{group:CommandGroup;label:string;items:Command[]}[];flat:Command[]};
/** Groups stay in a fixed order (screens, actions, projects); inside a group the best
 * match comes first, ties keep the list order. With no query, only the first few
 * projects are listed so the screens and actions stay in view. */
export function filterCommands(commands:readonly Command[],query:string,{emptyProjectLimit=5}:{emptyProjectLimit?:number}={}):CommandResults{
 const empty=words(query).length===0;
 const groups=GROUP_ORDER.map(group=>{
  let items=commands.map((c,i)=>({c,i,s:c.group===group?scoreCommand(c,query):null}))
   .filter((x):x is {c:Command;i:number;s:number}=>x.s!==null)
   .sort((a,b)=>a.s-b.s||a.i-b.i).map(x=>x.c);
  if(empty&&group==='project')items=items.slice(0,emptyProjectLimit);
  return {group,label:GROUP_LABELS[group],items};
 }).filter(g=>g.items.length>0);
 return {groups,flat:groups.flatMap(g=>g.items)};
}

/** Arrow keys move through the results and wrap; Home and End jump to the ends. */
export function nextActiveIndex(current:number,count:number,key:string):number|null{
 if(count<1)return null;
 switch(key){
  case 'ArrowDown':return current<0?0:(current+1)%count;
  case 'ArrowUp':return current<0?count-1:(current-1+count)%count;
  case 'Home':return 0;
  case 'End':return count-1;
  default:return null;
 }
}

type ShortcutEvent={key:string;metaKey:boolean;ctrlKey:boolean;altKey:boolean;shiftKey:boolean};
/** Cmd+K on a Mac, Ctrl+K elsewhere; any other modifier makes it a different shortcut. */
export function isPaletteShortcut(event:ShortcutEvent,platform:Platform):boolean{
 if(event.key.toLowerCase()!=='k'||event.altKey||event.shiftKey)return false;
 return platform==='mac'?event.metaKey&&!event.ctrlKey:event.ctrlKey&&!event.metaKey;
}
