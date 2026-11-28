/** A small built-in stroke icon set (no icon library). Decorative by default. */
const paths={
 bolt:'M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z',
 check:'M4.5 12.5 9.5 17.5 19.5 6.5',
 x:'M6 6l12 12M18 6 6 18',
 info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01',
 alert:'M12 3.5 2.8 19.5h18.4L12 3.5Zm0 6v4.5m0 3h.01',
 lock:'M6.5 10.5h11v9.5h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
 sortAsc:'M12 5v14M6.5 10.5 12 5l5.5 5.5',
 sortDesc:'M12 5v14M6.5 13.5 12 19l5.5-5.5',
 sortNone:'M8 9.5 12 5.5l4 4M8 14.5l4 4 4-4',
 plus:'M12 5v14M5 12h14',
 inbox:'M3.5 13.5 6 5.5h12l2.5 8m-17 0v5h17v-5m-17 0H9a3 3 0 0 0 6 0h5.5',
 sun:'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8L17 7m-10 10-1.4 1.4',
 moon:'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
 monitor:'M3.5 5h17v11h-17zM9 20h6m-3-4v4',
 clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2',
 file:'M6.5 3h7l4 4v14h-11zM13.5 3v4h4',
 help:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.6-11.5a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.8m0 3h.01',
 arrowLeft:'M19 12H5m6-6-6 6 6 6'
} as const;
export type IconName=keyof typeof paths;
export function Icon({name,size=16,className='',label}:{name:IconName;size?:number;className?:string;label?:string}){
 return <svg className={`tm-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" focusable="false"
  {...(label?{role:'img','aria-label':label}:{'aria-hidden':true})}><path d={paths[name]}/></svg>;
}
