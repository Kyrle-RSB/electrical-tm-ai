/** Purchase document review segments are suggestions until an authorized local operator approves. */
export const MATERIAL_DISPOSITIONS = ['project','stock','other-project','damaged','returned','warranty','nonbillable','other'] as const;
export type MaterialDisposition=typeof MATERIAL_DISPOSITIONS[number];
export type QuantitySplit={quantity:string;disposition:MaterialDisposition;projectId?:string;notes?:string};
const DEC=/^(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/;
function mills(input:string):bigint {
 const m=DEC.exec(input);
 if(!m)throw new Error('Quantity must be nonnegative with at most 3 decimals');
 return BigInt(m[1])*1000n+BigInt((m[2]||'').padEnd(3,'0')||'0');
}
export function verifyMaterialSplit(originalQuantity:string,splits:readonly QuantitySplit[]):{
  totalAllocatedMills:bigint;remainingMills:bigint
}{
 const available=mills(originalQuantity);
 if(!splits.length)throw new Error('A material line needs at least one disposition');
 let total=0n;
 for(const x of splits){
   if(!MATERIAL_DISPOSITIONS.includes(x.disposition))throw new Error('Unknown disposition');
   if((x.disposition==='project'||x.disposition==='other-project')&&!x.projectId)throw new Error('Target project is required');
   if(x.notes&&x.notes.length>2000)throw new Error('Notes too long');
   const n=mills(x.quantity);if(n<=0n)throw new Error('Quantity segments must be positive');
   total+=n;
 }
 if(total>available)throw new Error('Material dispositions exceed supplier quantity');
 return {totalAllocatedMills:total,remainingMills:available-total};
}
