import {roundRatio,type Cents} from '../shared/money';
/**
 * Owner-approved capacity policy: half-day = 0.5 day; unused capacity stays
 * unallocated. The project's half-day share is calculated against total daily
 * overhead, not distributed over just the active projects.
 * When indivisible cents require apportionment, assign remainder cents
 * deterministically by fractional remainder then stable project ID.
 */
export type ProjectWork={projectId:string;halfDays:1|2};
export function allocateDailyOverhead(dailyOverhead:Cents,entries:readonly ProjectWork[]):{
  allocations:Array<{projectId:string;allocatedCents:Cents}>;unallocatedCents:Cents;totalAssignedHalfDays:number
}{
 if(dailyOverhead<0n)throw new Error('Overhead must be nonnegative');
 if(new Set(entries.map(x=>x.projectId)).size!==entries.length)throw new Error('Duplicate project in overhead calendar');
 const total=entries.reduce((n,x)=>{
   if(!x.projectId||![1,2].includes(x.halfDays))throw new Error('Invalid half-day assignment');
   return n+x.halfDays;
 },0);
 if(total>2)throw new Error('Overlapping work requires an owner-approved allocation policy');
 const target=roundRatio(dailyOverhead*BigInt(total),2n);
 const rows=entries.map(x=>{
   const numerator=dailyOverhead*BigInt(x.halfDays);
   return {projectId:x.projectId,base:numerator/2n,remainder:numerator%2n};
 });
 const floorSum=rows.reduce((n,x)=>n+x.base,0n);
 let remainderCents=target-floorSum;
 const ranking=[...rows].sort((a,b)=>{
   if(a.remainder!==b.remainder)return a.remainder>b.remainder?-1:1;
   return a.projectId.localeCompare(b.projectId);
 });
 const cents=new Map<string,Cents>(rows.map(r=>[r.projectId,r.base]));
 for(const item of ranking){
   if(remainderCents===0n)break;
   cents.set(item.projectId,cents.get(item.projectId)!+1n);remainderCents--;
 }
 if(remainderCents!==0n)throw new Error('Overhead rounding apportionment failed');
 const allocations=entries.map(e=>({projectId:e.projectId,allocatedCents:cents.get(e.projectId)!}));
 const used=allocations.reduce((n,x)=>n+x.allocatedCents,0n);
 return {allocations,unallocatedCents:dailyOverhead-used,totalAssignedHalfDays:total};
}
