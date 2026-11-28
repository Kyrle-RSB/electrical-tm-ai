import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {DEFAULT_ROUTE,ROUTES,ROUTE_IDS,SIDEBAR_ROUTE_IDS,isRouteId,routeDefinition} from '../../apps/desktop/src/renderer/shell/routes';
import {ROUTE_STORAGE_KEY,SIDEBAR_STORAGE_KEY,createRouter,isSidebarCollapsed,readLastRoute,readSidebarChoice,writeLastRoute,writeSidebarChoice} from '../../apps/desktop/src/renderer/shell/router';
import {ACTION_IDS,buildCommands,filterCommands,isPaletteShortcut,nextActiveIndex,scoreCommand,type PaletteProject} from '../../apps/desktop/src/renderer/shell/commands';

const memory=()=>{const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};};
const broken={getItem:()=>{throw new Error('denied');},setItem:()=>{throw new Error('denied');},removeItem:()=>{throw new Error('denied');}};
const projects:PaletteProject[]=[
 {id:'p1',code:'SYN-001',customer:'Fictional Bakery Ltd',name:'Panel upgrade',archived:false},
 {id:'p2',code:'SYN-002',customer:'Sample Dental Office',name:'',archived:true},
 ...['3','4','5','6','7'].map(n=>({id:'p'+n,code:'DEMO-00'+n,customer:'Example Condo Board',name:'',archived:false}))
];

test('the sidebar lists exactly the eight screens, in order, with Settings at the end',()=>{
 assert.deepEqual([...SIDEBAR_ROUTE_IDS],['today','jobs','customers','crew','materials','invoices','reports','settings']);
 assert.deepEqual(ROUTES.filter(r=>r.placement==='main').map(r=>r.label),['Today','Jobs','Customers','Crew','Materials','Invoices','Reports']);
 assert.deepEqual(ROUTES.filter(r=>r.placement==='end').map(r=>r.id),['settings']);
 assert.deepEqual(ROUTES.filter(r=>r.placement==='none').map(r=>r.id),['components']);
 assert.deepEqual(ROUTES.map(r=>r.id),[...ROUTE_IDS]);
 assert.equal(new Set(ROUTES.map(r=>r.icon)).size,ROUTES.length,'each screen has its own icon');
 assert.equal(DEFAULT_ROUTE,'today');
});

test('screens not built yet each promise something specific; built screens do not',()=>{
 const built=['jobs','settings','components'];
 for(const route of ROUTES){
  if(built.includes(route.id)){assert.equal(route.coming,undefined,route.id);continue;}
  assert.ok(route.coming,route.id+' needs a designed empty state');
  assert.ok(route.coming.title.length>10&&route.coming.body.length>40,route.id);
  assert.equal(route.coming.points.length,3,route.id);
  assert.ok(isRouteId(route.coming.next.route)&&!routeDefinition(route.coming.next.route).coming,route.id+' points to a built screen');
 }
});

test('every icon the shell uses exists in the icon set, and no copy has an em dash',()=>{
 const icons=fs.readFileSync(path.join(process.cwd(),'apps/desktop/src/renderer/components/ui/Icon.tsx'),'utf8');
 for(const route of ROUTES)assert.match(icons,new RegExp(`\\n ${route.icon}:'`),route.icon);
 for(const command of buildCommands({projects:[],sidebarCollapsed:false}))assert.match(icons,new RegExp(`\\n ${command.icon}:'`),command.icon);
 assert.doesNotMatch(JSON.stringify(ROUTES),/\u2014/);
});

test('route ids are checked; unknown, missing or unreadable saved routes open Today',()=>{
 for(const id of ROUTE_IDS)assert.equal(isRouteId(id),true);
 for(const bad of ['', 'Jobs','home','__proto__',null,undefined,1,{}])assert.equal(isRouteId(bad),false);
 const store=memory();
 assert.equal(readLastRoute(store),'today');
 store.data.set(ROUTE_STORAGE_KEY,'settings');assert.equal(readLastRoute(store),'settings');
 store.data.set(ROUTE_STORAGE_KEY,'billing');assert.equal(readLastRoute(store),'today');
 assert.equal(readLastRoute(broken),'today');
 assert.equal(readLastRoute(null),'today');
 assert.doesNotThrow(()=>writeLastRoute('jobs',broken));
 writeLastRoute('crew',store);assert.equal(store.data.get(ROUTE_STORAGE_KEY),'crew');
 assert.throws(()=>routeDefinition('billing' as never));
});

test('the router remembers the last screen for the session and notifies on each navigation',()=>{
 const store=memory();
 const router=createRouter(readLastRoute(store),store);
 assert.deepEqual(router.get(),{route:'today',previous:null,focus:'none',sequence:0});
 let calls=0;const stop=router.subscribe(()=>{calls++;});
 router.navigate('jobs');
 assert.deepEqual(router.get(),{route:'jobs',previous:'today',focus:'none',sequence:1});
 router.navigate('components',{focus:'heading'});
 assert.deepEqual(router.get(),{route:'components',previous:'jobs',focus:'heading',sequence:2});
 // The same screen again keeps "previous" and still counts, so a focus request repeats.
 router.navigate('components',{focus:{elementId:'x'}});
 assert.deepEqual(router.get(),{route:'components',previous:'jobs',focus:{elementId:'x'},sequence:3});
 assert.equal(calls,3);
 assert.equal(store.data.get(ROUTE_STORAGE_KEY),'components');
 stop();router.navigate('settings');assert.equal(calls,3,'unsubscribed');
 assert.throws(()=>router.navigate('billing' as never));
 assert.equal(router.get().route,'settings');
 // A new window in the same session opens where the last one was.
 assert.equal(createRouter(readLastRoute(store),store).get().route,'settings');
 // A blocked store never stops navigation.
 const blocked=createRouter('today',broken);blocked.navigate('reports');assert.equal(blocked.get().route,'reports');
});

test('the sidebar is expanded on a wide window unless collapsed, and icons only below 1200 px',()=>{
 assert.equal(isSidebarCollapsed({narrow:false,wideChoice:'expanded',expandedWhileNarrow:false}),false);
 assert.equal(isSidebarCollapsed({narrow:false,wideChoice:'collapsed',expandedWhileNarrow:false}),true);
 assert.equal(isSidebarCollapsed({narrow:true,wideChoice:'expanded',expandedWhileNarrow:false}),true);
 assert.equal(isSidebarCollapsed({narrow:true,wideChoice:'collapsed',expandedWhileNarrow:true}),false);
 assert.equal(isSidebarCollapsed({narrow:false,wideChoice:'expanded',expandedWhileNarrow:true}),false);
 const store=memory();
 assert.equal(readSidebarChoice(store),'expanded');
 writeSidebarChoice('collapsed',store);assert.equal(store.data.get(SIDEBAR_STORAGE_KEY),'collapsed');assert.equal(readSidebarChoice(store),'collapsed');
 writeSidebarChoice('expanded',store);assert.equal(store.data.has(SIDEBAR_STORAGE_KEY),false);
 assert.equal(readSidebarChoice(broken),'expanded');
 assert.doesNotThrow(()=>writeSidebarChoice('collapsed',broken));
});

test('the palette lists every screen, every action and every project, with unique ids',()=>{
 const commands=buildCommands({projects,sidebarCollapsed:false});
 assert.equal(new Set(commands.map(c=>c.id)).size,commands.length);
 const screens=commands.filter(c=>c.group==='navigate');
 assert.deepEqual(screens.map(c=>c.intent.kind==='navigate'&&c.intent.route),[...ROUTE_IDS]);
 assert.deepEqual(screens.filter(c=>c.detail==='Coming soon').map(c=>c.label),['Today','Customers','Crew','Materials','Invoices','Reports']);
 assert.deepEqual(commands.filter(c=>c.group==='action').map(c=>c.intent.kind==='action'&&c.intent.action),[...ACTION_IDS]);
 const saved=commands.filter(c=>c.group==='project');
 assert.equal(saved.length,projects.length);
 assert.deepEqual(saved[0],{id:'project-p1',group:'project',label:'SYN-001',detail:'Fictional Bakery Ltd',icon:'briefcase',keywords:['Fictional Bakery Ltd','Panel upgrade'],intent:{kind:'project',projectId:'p1'}});
 assert.equal(saved[1].detail,'Sample Dental Office · Archived');
 const toggle=(collapsed:boolean)=>buildCommands({projects:[],sidebarCollapsed:collapsed}).find(c=>c.id==='toggle-sidebar')?.label;
 assert.equal(toggle(false),'Collapse sidebar');assert.equal(toggle(true),'Expand sidebar');
});

test('an empty query shows screens and actions in order, and only the first five projects',()=>{
 const commands=buildCommands({projects,sidebarCollapsed:false});
 const result=filterCommands(commands,'   ');
 assert.deepEqual(result.groups.map(g=>g.label),['Go to','Actions','Projects']);
 assert.equal(result.groups[0].items.length,ROUTE_IDS.length);
 assert.equal(result.groups[1].items.length,ACTION_IDS.length);
 assert.deepEqual(result.groups[2].items.map(c=>c.label),['SYN-001','SYN-002','DEMO-003','DEMO-004','DEMO-005']);
 assert.deepEqual(result.flat,result.groups.flatMap(g=>g.items));
 assert.equal(filterCommands(commands,'',{emptyProjectLimit:0}).groups.some(g=>g.group==='project'),false);
});

test('typing filters by label, then words, then keywords, case-insensitively',()=>{
 const commands=buildCommands({projects,sidebarCollapsed:false});
 const labels=(q:string)=>filterCommands(commands,q).flat.map(c=>c.label);
 assert.deepEqual(labels('jobs'),['Jobs','New project']);
 assert.deepEqual(labels('SETT'),['Settings']);
 assert.deepEqual(labels('theme'),['Settings','Use light theme','Use dark theme','Follow system theme']);
 assert.deepEqual(labels('dark'),['Use dark theme']);
 assert.deepEqual(labels('bakery'),['SYN-001'],'matches a project by customer');
 assert.deepEqual(labels('demo-006'),['DEMO-006'],'projects past the first five are found by search');
 assert.deepEqual(labels('new proj'),['New project'],'every word must match');
 assert.deepEqual(labels('price book'),['Materials']);
 assert.deepEqual(labels('zzz'),[]);
 assert.equal(filterCommands(commands,'zzz').groups.length,0);
 const settings=commands.find(c=>c.id==='go-settings');
 if(!settings)throw new Error('missing');
 assert.ok((scoreCommand(settings,'settings')??99)<(scoreCommand(settings,'backup')??99),'a label match outranks a keyword match');
 assert.equal(scoreCommand(settings,'billing'),null);
});

test('palette keys move through the results and wrap; only Mod+K opens it',()=>{
 assert.equal(nextActiveIndex(0,4,'ArrowDown'),1);
 assert.equal(nextActiveIndex(3,4,'ArrowDown'),0);
 assert.equal(nextActiveIndex(0,4,'ArrowUp'),3);
 assert.equal(nextActiveIndex(-1,4,'ArrowDown'),0);
 assert.equal(nextActiveIndex(-1,4,'ArrowUp'),3);
 assert.equal(nextActiveIndex(2,4,'Home'),0);
 assert.equal(nextActiveIndex(1,4,'End'),3);
 assert.equal(nextActiveIndex(1,4,'Tab'),null);
 assert.equal(nextActiveIndex(0,0,'ArrowDown'),null);
 const key=(k:string,mods:Partial<{metaKey:boolean;ctrlKey:boolean;altKey:boolean;shiftKey:boolean}>={})=>({key:k,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,...mods});
 assert.equal(isPaletteShortcut(key('k',{metaKey:true}),'mac'),true);
 assert.equal(isPaletteShortcut(key('K',{metaKey:true}),'mac'),true);
 assert.equal(isPaletteShortcut(key('k',{ctrlKey:true}),'mac'),false);
 assert.equal(isPaletteShortcut(key('k',{ctrlKey:true}),'other'),true);
 assert.equal(isPaletteShortcut(key('k',{metaKey:true}),'other'),false);
 assert.equal(isPaletteShortcut(key('k',{ctrlKey:true,shiftKey:true}),'other'),false);
 assert.equal(isPaletteShortcut(key('k',{metaKey:true,altKey:true}),'mac'),false);
 assert.equal(isPaletteShortcut(key('j',{metaKey:true}),'mac'),false);
 assert.equal(isPaletteShortcut(key('k'),'mac'),false);
});
