/** Every screen the shell can show, in sidebar order. Plain data, no React, so the
 * router and the command palette are unit tested against the same table. */

/** Icon names the shell uses. Each must exist in components/ui/Icon.tsx; the desktop
 * typecheck proves it where the shell passes them to <Icon>. */
export type ShellIcon='calendar'|'briefcase'|'users'|'hardHat'|'box'|'receipt'|'chart'|'sliders'|'file'|'plus'|'check'|'sun'|'moon'|'monitor'|'help'|'panelLeft'|'search'|'arrowRight';

export const SIDEBAR_ROUTE_IDS=['today','jobs','customers','crew','materials','invoices','reports','settings'] as const;
/** Screens reached from Help or the palette, never from the sidebar. */
export const EXTRA_ROUTE_IDS=['components'] as const;
export const ROUTE_IDS=[...SIDEBAR_ROUTE_IDS,...EXTRA_ROUTE_IDS] as const;
export type SidebarRouteId=typeof SIDEBAR_ROUTE_IDS[number];
export type RouteId=typeof ROUTE_IDS[number];
export const DEFAULT_ROUTE:RouteId='today';

/** What a screen that is not built yet promises. Shown as a designed empty state. */
export type ComingSoon={title:string;body:string;points:readonly string[];next:{route:RouteId;label:string}};
export type RouteDefinition={
 id:RouteId;label:string;icon:ShellIcon;
 /** Sidebar placement: the main list, the bottom of the sidebar, or not in it. */
 placement:'main'|'end'|'none';
 /** One line under the screen title. */
 summary:string;
 /** Extra words the palette matches on. */
 keywords:readonly string[];
 /** Present only for screens that are not built yet. */
 coming?:ComingSoon;
};

export const ROUTES:readonly RouteDefinition[]=[
 {id:'today',label:'Today',icon:'calendar',placement:'main',summary:'Your day at a glance.',keywords:['home','dashboard','overview'],
  coming:{title:'Your day at a glance is on the way',body:'Today will open on what needs you now, worked out from your own jobs, time and invoices.',
   points:['Unbilled time and materials, by job','Invoices due this week and overdue','This month billed and collected'],next:{route:'jobs',label:'Go to Jobs'}}},
 {id:'jobs',label:'Jobs',icon:'briefcase',placement:'main',summary:'Fictional jobs only. Each one keeps its code, customer and job-site address.',keywords:['projects','work','sites']},
 {id:'customers',label:'Customers',icon:'users',placement:'main',summary:'The people and businesses you work for.',keywords:['clients','contacts','addresses'],
  coming:{title:'Customers are on the way',body:'Each customer will keep its contacts and site addresses, with every job you have done for them.',
   points:['Contacts and site addresses','Every job for a customer in one place','Search by name, address or phone'],next:{route:'jobs',label:'Go to Jobs'}}},
 {id:'crew',label:'Crew',icon:'hardHat',placement:'main',summary:'Who works on your jobs, and what an hour of their time costs and bills.',keywords:['people','staff','workers','rates','time','timesheets'],
  coming:{title:'Crew is on the way',body:'Each person will have a role and dated rates, so past hours keep the rate they were worked at.',
   points:['Journeyperson, apprentice and helper roles','Dated bill-out and cost rates','Overtime and after-hours multipliers'],next:{route:'jobs',label:'Go to Jobs'}}},
 {id:'materials',label:'Materials',icon:'box',placement:'main',summary:'What you buy, what it costs and what you bill for it.',keywords:['price book','supplies','receipts','stock','markup'],
  coming:{title:'Materials are on the way',body:'A price book and supplier receipts, split across jobs and stock, with markup and margin both shown.',
   points:['Price book with cost and default markup','Supplier receipts with a photo','Returns and credits back to the job'],next:{route:'jobs',label:'Go to Jobs'}}},
 {id:'invoices',label:'Invoices',icon:'receipt',placement:'main',summary:'Bills built from the time and materials on a job.',keywords:['billing','payments','credit notes','tickets'],
  coming:{title:'Invoices are on the way',body:'Invoices will be built from a job\'s unbilled time and materials. An issued invoice is frozen and corrected only with a credit note.',
   points:['Gapless invoice numbers','Full and part payments, with receipts','Branded PDF with your terms'],next:{route:'jobs',label:'Go to Jobs'}}},
 {id:'reports',label:'Reports',icon:'chart',placement:'main',summary:'How the business is doing, and exports for your accountant.',keywords:['profit','export','csv','accountant'],
  coming:{title:'Reports are on the way',body:'Reports will show estimated profit per job and export your records for your accountant.',
   points:['Estimated profit per job','Invoices, payments, time and materials as CSV','Any date range'],next:{route:'jobs',label:'Go to Jobs'}}},
 {id:'settings',label:'Settings',icon:'sliders',placement:'end',summary:'Business profile, appearance, backups and the foundation tools.',keywords:['preferences','business profile','appearance','theme','backup','restore','logo']},
 {id:'components',label:'Components',icon:'file',placement:'none',summary:'Every token and component in the design system.',keywords:['design system','tokens','colours','colors']}
];

const byId=new Map(ROUTES.map(r=>[r.id,r]));
export function routeDefinition(id:RouteId):RouteDefinition{
 const route=byId.get(id);
 if(!route)throw new Error('Unknown route');
 return route;
}
export function isRouteId(value:unknown):value is RouteId{
 return typeof value==='string'&&(ROUTE_IDS as readonly string[]).includes(value);
}
