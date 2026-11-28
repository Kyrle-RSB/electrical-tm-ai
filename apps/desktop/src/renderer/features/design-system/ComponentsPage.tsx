import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Badge,Button,Card,Checkbox,DateField,Dialog,EmptyState,Kbd,MoneyField,NumberField,SegmentedControl,SelectField,Stat,StatusBadge,Switch,Table,Tabs,TextArea,TextField,Tooltip,displayMoney,normalizeMoneyInput,useToast,type BadgeTone,type Column,type SegmentOption} from '../../components/ui';
import {useAppearance} from '../../theme/AppearanceProvider';
import type {AppearancePreference} from '../../theme/system-theme';
import {contrastRatio} from '../../theme/contrast';
import {colorTokens,contrastPairs,durations,easings,radii,shadows,spaceSteps,statuses,textSizes,type ColorToken,type Status} from '../../theme/tokens';

/** Every token and component on one page, for design review and screenshots.
 * All names and amounts here are fictional. Reached from Help. */

const colorGroups:{title:string;tokens:readonly ColorToken[]}[]=[
 {title:'Surfaces',tokens:['bg','surface','surface-subtle','surface-hover','surface-selected']},
 {title:'Lines',tokens:['border','border-strong','border-control']},
 {title:'Text',tokens:['text','text-secondary','text-muted']},
 {title:'Accent: high-voltage amber',tokens:['accent','accent-hover','accent-pressed','accent-subtle','accent-text','text-on-accent','focus-ring']},
 {title:'Feedback',tokens:['danger','danger-hover','danger-text','danger-subtle','success-text','success-subtle','info-text','info-subtle']},
 {title:'Overlays',tokens:['skeleton','overlay','tooltip-bg','tooltip-text','text-on-danger']}
];

type InvoiceRow={id:string;number:string;customer:string;job:string;hours:string;amount:string;status:Status};
const invoices:readonly InvoiceRow[]=[
 {id:'1',number:'INV-1041',customer:'Fictional Bakery Ltd',job:'Panel upgrade, 200 A',hours:'14.50',amount:'4860.00',status:'paid'},
 {id:'2',number:'INV-1042',customer:'Sample Dental Office',job:'Lighting retrofit, suite B',hours:'22.25',amount:'7312.40',status:'sent'},
 {id:'3',number:'INV-1043',customer:'Example Condo Board',job:'EV charger circuit',hours:'6.00',amount:'1284.50',status:'overdue'},
 {id:'4',number:'INV-1044',customer:'Demo Plaza Unit 4',job:'Service call, tripped breaker',hours:'1.75',amount:'312.00',status:'draft'},
 {id:'5',number:'T&M-0388',customer:'Test Kitchen Co.',job:'Hood fan rough-in',hours:'9.00',amount:'2950.75',status:'signed'},
 {id:'6',number:'INV-1039',customer:'Fictional Bakery Ltd',job:'Exterior sign circuit',hours:'3.50',amount:'980.00',status:'locked'}
];
const columns:readonly Column<InvoiceRow>[]=[
 {key:'number',header:'Number',sortValue:r=>r.number,render:r=><span className="tm-num">{r.number}</span>,width:'narrow'},
 {key:'customer',header:'Customer',sortValue:r=>r.customer,render:r=><div className="cell-stack"><span>{r.customer}</span><span className="muted">{r.job}</span></div>,width:'wide'},
 {key:'status',header:'Status',sortValue:r=>statuses.indexOf(r.status),render:r=><StatusBadge status={r.status}/>},
 {key:'hours',header:'Hours',numeric:true,sortValue:r=>r.hours,render:r=>r.hours},
 {key:'amount',header:'Amount',numeric:true,sortValue:r=>r.amount,render:r=>displayMoney(r.amount)}
];

const themeOptions:readonly SegmentOption<AppearancePreference>[]=[
 {value:'system',label:'System',icon:'monitor'},{value:'light',label:'Light',icon:'sun'},{value:'dark',label:'Dark',icon:'moon'}
];

function Section({id,title,description,children}:{id:string;title:string;description?:string;children:ReactNode}){
 return <Card as="section" title={title} titleId={id} description={description} className="ds-section">{children}</Card>;
}
function readTokens(names:readonly string[]):Record<string,string>{
 const style=getComputedStyle(document.documentElement);
 return Object.fromEntries(names.map(n=>[n,style.getPropertyValue(n).trim()]));
}

export function ComponentsPage({onBack}:{onBack:()=>void}){
 const {preference,appearance,setPreference}=useAppearance();
 const toast=useToast();
 const [values,setValues]=useState<Record<string,string>>({});
 useEffect(()=>{
  const names=[...colorTokens.map(k=>`--tm-color-${k}`),...statuses.flatMap(s=>[`--tm-status-${s}-fg`,`--tm-status-${s}-bg`]),...durations.map(d=>`--tm-duration-${d}`),...easings.map(e=>`--tm-ease-${e}`)];
  const frame=requestAnimationFrame(()=>setValues(readTokens(names)));
  return()=>cancelAnimationFrame(frame);
 },[appearance]);
 const ratios=useMemo(()=>contrastPairs.map(p=>{
  const fg=values[p.fg],bg=values[p.bg];
  let ratio:number|null=null;try{if(fg&&bg)ratio=contrastRatio(fg,bg);}catch{ratio=null;}
  return {...p,ratio};
 }),[values]);
 const [dialogOpen,setDialogOpen]=useState(false);
 const [tableView,setTableView]=useState<'rows'|'empty'|'loading'>('rows');
 const [money,setMoney]=useState('1,284.5');
 const [hours,setHours]=useState('7.50');
 const [crew,setCrew]=useState('');
 const [notify,setNotify]=useState(true);
 const [overtime,setOvertime]=useState(false);
 const [rateKind,setRateKind]=useState<'standard'|'overtime'|'after-hours'>('standard');
 const normalizedMoney=normalizeMoneyInput(money);
 const toneBadges:{tone:BadgeTone;label:string}[]=[{tone:'neutral',label:'Neutral'},{tone:'accent',label:'Accent'},{tone:'info',label:'Info'},{tone:'success',label:'Success'},{tone:'danger',label:'Danger'},{tone:'violet',label:'Violet'},{tone:'slate',label:'Slate'}];

 return <div className="ds-page">
  <div className="ds-header">
   <div className="ds-header__text">
    <Button variant="ghost" size="sm" icon="arrowLeft" onClick={onBack}>Back to cockpit</Button>
    <h1>Components</h1>
    <p className="muted">The Electrical T&amp;M design system: tokens from one file, Inter for type, high-voltage amber on calm greys. Everything here is fictional sample data.</p>
   </div>
   <div className="ds-header__theme"><span className="ds-header__label">Theme</span>
    <SegmentedControl legend="Theme for this page and the app" name="ds-theme" options={themeOptions} value={preference} onChange={setPreference}/>
    <span className="muted">Showing {appearance}</span></div>
  </div>

  <Section id="ds-colour" title="Colour" description="Neutral greys with one accent. Every colour is a token; dark mode redefines the same names.">
   <div className="ds-colour-groups">{colorGroups.map(g=><div key={g.title} className="ds-colour-group"><h3 className="ds-subhead">{g.title}</h3>
    <ul className="ds-swatches">{g.tokens.map(t=><li key={t} className="ds-swatch"><span className={`ds-swatch__chip sw-${t}`} aria-hidden="true"/>
     <span className="ds-swatch__name">{t}</span><span className="ds-swatch__value tm-num">{values[`--tm-color-${t}`]??''}</span></li>)}</ul></div>)}</div>
   <h3 className="ds-subhead">Status</h3>
   <ul className="ds-status-row">{statuses.map(s=><li key={s} className="ds-status"><StatusBadge status={s}/><span className="ds-swatch__value tm-num">{values[`--tm-status-${s}-fg`]} on {values[`--tm-status-${s}-bg`]}</span></li>)}</ul>
  </Section>

  <Section id="ds-contrast" title="Contrast" description={`Measured live from the ${appearance} tokens. Body text needs 4.5:1; focus rings and field borders need 3:1.`}>
   <Table caption="Contrast of token pairs" rowKey={r=>r.use} columns={[
    {key:'use',header:'Pair',render:r=>r.use,width:'wide'},
    {key:'tokens',header:'Tokens',render:r=><span className="muted ds-pair-names">{r.fg.slice(5)} on {r.bg.slice(5)}</span>},
    {key:'ratio',header:'Ratio',numeric:true,sortValue:r=>r.ratio??-1,render:r=>r.ratio===null?'...':r.ratio.toFixed(2)+':1'},
    {key:'min',header:'Needs',numeric:true,render:r=>r.min+':1'},
    {key:'result',header:'Result',render:r=>r.ratio===null?<Badge>Measuring</Badge>:r.ratio>=r.min?<Badge tone="success" dot>Pass</Badge>:<Badge tone="danger" dot>Fail</Badge>}
   ]} rows={ratios} dense/>
  </Section>

  <Section id="ds-type" title="Type" description="Inter, bundled with the app (no internet needed). Numbers use tabular figures so columns line up.">
   <ul className="ds-type-list">{[...textSizes].reverse().map(s=><li key={s} className="ds-type-row"><span className="ds-type-row__name">{s}</span>
    <span className={`ds-type-sample ds-text-${s}`}>{s.startsWith('figure')?'$12,480.00':'Panel upgrade, 200 A service'}</span></li>)}</ul>
   <div className="ds-figures">
    <Stat label="Unbilled work" value={displayMoney('12480.00')} hint="Across 7 fictional jobs" tone="accent"/>
    <Stat label="Hours this week" value="162.50" unit="h" hint="Crew of four"/>
    <Stat label="Overdue" value={displayMoney('1284.50')} hint="1 invoice" tone="danger"/>
    <Stat label="Collected this month" value={displayMoney('21907.15')} tone="success"/>
   </div>
   <div className="ds-tnum"><div><h3 className="ds-subhead">Tabular figures</h3><p className="tm-num ds-num-col">1,111.11<br/>8,808.80<br/>410.00</p></div>
    <div><h3 className="ds-subhead">Proportional (not for numbers)</h3><p className="ds-num-col ds-num-col--proportional">1,111.11<br/>8,808.80<br/>410.00</p></div></div>
  </Section>

  <Section id="ds-scale" title="Space, radius, shadow and motion" description="A 4 px spacing grid, small radii and quiet shadows. Motion is short and switches off when the computer asks for reduced motion.">
   <div className="ds-scale-grid">
    <div><h3 className="ds-subhead">Spacing</h3><ul className="ds-space-list">{spaceSteps.map(s=><li key={s}><span className="ds-space-list__name tm-num">space-{s}</span><span className={`ds-space-bar ds-space-${s}`}/></li>)}</ul></div>
    <div><h3 className="ds-subhead">Radius</h3><ul className="ds-box-row">{radii.map(r=><li key={r} className={`ds-box ds-radius-${r}`}>{r}</li>)}</ul>
     <h3 className="ds-subhead">Shadow</h3><ul className="ds-box-row">{shadows.map(s=><li key={s} className={`ds-box ds-box--raised ds-shadow-${s}`}>{s}</li>)}</ul>
     <h3 className="ds-subhead">Motion</h3><ul className="ds-motion-list">{durations.map(d=><li key={d}><span>duration-{d}</span><span className="tm-num muted">{values[`--tm-duration-${d}`]}</span></li>)}
      {easings.map(e=><li key={e}><span>ease-{e}</span><span className="tm-num muted">{values[`--tm-ease-${e}`]}</span></li>)}</ul></div>
   </div>
  </Section>

  <Section id="ds-buttons" title="Buttons" description="One primary action per area. Secondary for the rest, ghost for quiet actions, danger only for actions that remove something.">
   <div className="ds-button-grid">{(['primary','secondary','ghost','danger'] as const).map(v=><div key={v} className="ds-button-row"><span className="ds-row-label">{v}</span>
    <Button variant={v} size="sm">Small</Button><Button variant={v}>Medium</Button><Button variant={v} size="lg">Large</Button>
    <Button variant={v} loading>Saving</Button><Button variant={v} disabled>Disabled</Button></div>)}</div>
   <div className="ds-button-row"><span className="ds-row-label">icons</span>
    <Button variant="primary" icon="plus">New job</Button><Button icon="clock">Start timer</Button><Button variant="ghost" icon="file">Export CSV</Button>
    <Tooltip content="Lock the ticket after signing"><Button iconOnly icon="lock">Lock ticket</Button></Tooltip></div>
  </Section>

  <Section id="ds-fields" title="Fields" description="Label above, hint below, error in words with an icon. Numbers, money and hours are right aligned.">
   <div className="ds-field-grid">
    <TextField label="Job name" placeholder="For example, Panel upgrade" hint="Shown on tickets and invoices."/>
    <TextField label="Customer email" type="email" defaultValue="office@example.invalid" error="Enter a full email address, like name@example.com."/>
    <NumberField label="Hours" suffix="h" value={hours} onChange={e=>setHours(e.target.value)} hint="Quarter hours, for example 7.25."/>
    <MoneyField label="Material cost" value={money} onChange={e=>setMoney(e.target.value)}
     hint={normalizedMoney!==null?`Saved as ${normalizedMoney}`:undefined} error={normalizedMoney===null?'Use dollars and cents, like 1284.50.':undefined}/>
    <DateField label="Work date" defaultValue="2026-11-24"/>
    <SelectField label="Crew member" value={crew} onChange={e=>setCrew(e.target.value)} placeholder="Choose a person" hint="Fictional crew." options={[{value:'a',label:'Alex Sample, journeyperson'},{value:'b',label:'Bo Example, apprentice'},{value:'c',label:'Casey Demo, helper'}]}/>
    <TextArea label="Ticket notes" optional className="ds-field-grid__wide" defaultValue="Replaced two 15 A breakers. Customer to confirm the panel label." />
    <TextField label="Disabled field" disabled defaultValue="Locked after invoicing"/>
   </div>
   <div className="ds-choice-grid">
    <div className="ds-choice-col"><h3 className="ds-subhead">Checkbox</h3>
     <Checkbox label="Include materials" description="Adds unbilled materials to this invoice." defaultChecked/>
     <Checkbox label="Attach signed T&amp;M tickets"/>
     <Checkbox label="Disabled option" disabled/></div>
    <div className="ds-choice-col"><h3 className="ds-subhead">Switch</h3>
     <Switch label="Backup reminders" description="A weekly nudge if no backup was made." checked={notify} onChange={e=>setNotify(e.target.checked)}/>
     <Switch label="Overtime multiplier" checked={overtime} onChange={e=>setOvertime(e.target.checked)}/></div>
    <div className="ds-choice-col"><h3 className="ds-subhead">Segmented</h3>
     <SegmentedControl legend="Rate" name="ds-rate" value={rateKind} onChange={setRateKind} options={[{value:'standard',label:'Standard'},{value:'overtime',label:'Overtime'},{value:'after-hours',label:'After hours'}]}/></div>
   </div>
  </Section>

  <Section id="ds-table" title="Table" description="Click a header to sort; numbers right aligned in tabular figures. Empty and loading states keep the layout steady.">
   <Tabs label="Table state" value={tableView} onChange={setTableView} items={[
    {value:'rows',label:'With rows',count:invoices.length,content:<Table caption="Fictional invoices" columns={columns} rows={invoices} rowKey={r=>r.id} initialSort={{key:'number',direction:'ascending'}}
     footer={<tr><td colSpan={3}>Total</td><td className="tm-cell--numeric">57.00</td><td className="tm-cell--numeric">{displayMoney('17699.65')}</td></tr>}/>},
    {value:'empty',label:'Empty',content:<Table caption="Fictional invoices, none" columns={columns} rows={[]} rowKey={r=>r.id}
     empty={<EmptyState compact icon="file" title="No invoices yet" actions={<Button variant="primary" size="sm" icon="plus">New invoice</Button>}>Unbilled time and materials turn into an invoice here.</EmptyState>}/>},
    {value:'loading',label:'Loading',content:<Table caption="Fictional invoices, loading" columns={columns} rows={[]} rowKey={r=>r.id} loading/>}
   ]}/>
  </Section>

  <div className="ds-two-col">
   <Section id="ds-cards" title="Cards and badges" description="Cards group one task. Badges name a state in words, never colour alone.">
    <Card as="div" headingLevel={3} title="Job 2417: Panel upgrade" description="Fictional Bakery Ltd · 12 Sample Road"
     actions={<StatusBadge status="signed">Ticket signed</StatusBadge>}
     footer={<><Button variant="ghost" size="sm">View ticket</Button><Button variant="primary" size="sm">Create invoice</Button></>}>
     <div className="ds-figures ds-figures--compact"><Stat label="Unbilled" value={displayMoney('4860.00')}/><Stat label="Hours" value="14.50" unit="h"/></div>
    </Card>
    <h3 className="ds-subhead">Status badges</h3>
    <div className="ds-badge-row">{statuses.map(s=><StatusBadge key={s} status={s}/>)}</div>
    <h3 className="ds-subhead">Tones</h3>
    <div className="ds-badge-row">{toneBadges.map(b=><Badge key={b.tone} tone={b.tone}>{b.label}</Badge>)}</div>
   </Section>
   <Section id="ds-overlays" title="Dialog, toast and empty state" description="Dialogs for decisions, toasts for quick confirmations.">
    <div className="ds-button-row">
     <Button variant="danger" onClick={()=>setDialogOpen(true)}>Archive job...</Button>
     <Button onClick={()=>toast({title:'Invoice INV-1044 saved',body:'Draft kept on this computer.',tone:'success'})}>Success toast</Button>
     <Button onClick={()=>toast({title:'Backup finished',body:'Verify it before relying on it.',tone:'info'})}>Info toast</Button>
     <Button onClick={()=>toast({title:'No backup this week',body:'Choose a backup folder in Settings.',tone:'warning'})}>Warning toast</Button>
     <Button onClick={()=>toast({title:'Could not save',body:'The local database is busy. Try again.',tone:'danger'})}>Error toast</Button>
    </div>
    <EmptyState icon="clock" title="No time logged today" actions={<><Button variant="primary" size="sm" icon="plus">Log time</Button><Button size="sm" variant="ghost">Start timer</Button></>}>
     Log hours for one or more crew against a job. They show up here as you go.</EmptyState>
   </Section>
  </div>

  <Section id="ds-keys" title="Tabs, tooltip and keyboard hints" description="Everything works from the keyboard. Arrow keys move between tabs; Escape closes tooltips and dialogs.">
   <ul className="ds-kbd-list">
    <li><Kbd keys={['Mod','K']}/><span>Command palette</span></li>
    <li><Kbd keys={['Mod','Enter']}/><span>Save and close</span></li>
    <li><Kbd keys={['Shift','Mod','T']}/><span>Start or stop the timer</span></li>
    <li><Kbd keys={['Escape']}/><span>Close</span></li>
   </ul>
   <div className="ds-button-row"><Tooltip content="Search jobs, customers and invoices"><Button icon="help" variant="ghost">Hover or focus me</Button></Tooltip>
    <Tooltip content="Bottom placement" placement="bottom"><Button size="sm">Tooltip below</Button></Tooltip></div>
  </Section>

  <Dialog open={dialogOpen} onClose={()=>setDialogOpen(false)} title="Archive job 2417?" description="Archived jobs leave the job list but keep their hours, materials and invoices."
   footer={<><Button variant="ghost" onClick={()=>setDialogOpen(false)}>Cancel</Button><Button variant="danger" onClick={()=>{setDialogOpen(false);toast({title:'Job 2417 archived',tone:'success'});}}>Archive job</Button></>}>
   <TextField label="Reason" hint="Saved in the audit trail." defaultValue="Work complete, final invoice paid."/>
  </Dialog>
 </div>;
}
