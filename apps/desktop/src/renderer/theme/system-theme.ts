/** Display follows the operating system only: no user toggle or clock-based scheduler. */
export function getSystemAppearance(): 'dark'|'light'{
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export function subscribeToSystemAppearance(listener:(appearance:'dark'|'light')=>void):()=>void{
 const query=window.matchMedia?.('(prefers-color-scheme: dark)');
 if(!query)return()=>{};
 const changed=()=>listener(query.matches?'dark':'light');
 query.addEventListener('change',changed);
 return()=>query.removeEventListener('change',changed);
}
