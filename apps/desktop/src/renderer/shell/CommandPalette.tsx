import {useEffect,useId,useMemo,useState,type KeyboardEvent} from 'react';
import {Dialog,EmptyState,Icon,Kbd} from '../components/ui';
import {filterCommands,nextActiveIndex,type Command} from './commands';

/** Cmd+K (Ctrl+K on Windows). A native modal dialog, so focus is trapped and goes back
 * to where it was on close. Fully keyboard driven: type to filter, arrows to move,
 * Enter to run, Escape to close. The input is a combobox over a listbox of results. */
export function CommandPalette({open,initialQuery,commands,onRun,onClose}:{open:boolean;initialQuery:string;commands:readonly Command[];onRun:(command:Command)=>void;onClose:()=>void}){
 return <Dialog open={open} onClose={onClose} title="Command palette" size="lg" className="palette-dialog">
  <PaletteBody initialQuery={initialQuery} commands={commands} onRun={onRun}/>
 </Dialog>;
}

/** Mounted fresh on every open (the dialog renders its body only while open). */
function PaletteBody({initialQuery,commands,onRun}:{initialQuery:string;commands:readonly Command[];onRun:(command:Command)=>void}){
 const id=useId();
 const [query,setQuery]=useState(initialQuery);
 const [active,setActive]=useState(0);
 const results=useMemo(()=>filterCommands(commands,query),[commands,query]);
 const count=results.flat.length;
 const current=count?Math.min(active,count-1):-1;
 const optionId=(index:number)=>`${id}-option-${index}`;
 useEffect(()=>{if(current>=0)document.getElementById(optionId(current))?.scrollIntoView({block:'nearest'});});
 const keyDown=(event:KeyboardEvent<HTMLInputElement>)=>{
  const next=nextActiveIndex(current,count,event.key);
  if(next!==null){event.preventDefault();setActive(next);return;}
  if(event.key==='Enter'){event.preventDefault();const command=results.flat[current];if(command)onRun(command);}
 };
 let index=-1;
 return <div className="palette">
  <label className="palette__search">
   <Icon name="search" size={18} className="palette__search-icon"/>
   <span className="tm-visually-hidden">Search screens, actions and projects</span>
   <input data-autofocus className="tm-input palette__input" type="text" role="combobox" autoComplete="off" spellCheck={false}
    aria-expanded={count>0} aria-controls={id+'-results'} aria-autocomplete="list" aria-activedescendant={current>=0?optionId(current):undefined}
    placeholder="Type a screen, an action or a project code" value={query}
    onChange={event=>{setQuery(event.target.value);setActive(0);}} onKeyDown={keyDown}/>
  </label>
  {count===0
   ?<EmptyState compact icon="search" title="Nothing matches">Try a screen such as Jobs or Settings, an action such as New project, or a project code.</EmptyState>
   :<div className="palette__results" id={id+'-results'} role="listbox" aria-label="Results">
    {results.groups.map(group=><div key={group.group} className="palette__group" role="group" aria-labelledby={`${id}-group-${group.group}`}>
     <div className="palette__group-label" id={`${id}-group-${group.group}`} aria-hidden="true">{group.label}</div>
     {group.items.map(command=>{
      index++;const position=index,selected=position===current;
      return <div key={command.id} id={optionId(position)} role="option" aria-selected={selected} className={`palette__option${selected?' is-active':''}`}
       onMouseMove={()=>{if(!selected)setActive(position);}} onMouseDown={event=>event.preventDefault()} onClick={()=>onRun(command)}>
       <span className="palette__option-icon"><Icon name={command.icon}/></span>
       <span className="palette__option-label">{command.label}</span>
       <span className="palette__option-detail">{command.detail}</span>
      </div>;
     })}
    </div>)}
   </div>}
  <div className="palette__hints" aria-hidden="true">
   <span><Kbd keys={['↑']}/><Kbd keys={['↓']}/> move</span>
   <span><Kbd keys={['Enter']}/> open</span>
   <span><Kbd keys={['Escape']}/> close</span>
  </div>
 </div>;
}
