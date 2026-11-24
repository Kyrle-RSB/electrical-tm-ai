/** Exact, signed fixed-scale quantities; the storage unit is 1/1000. */
export type QuantityMills = bigint;
const DECIMAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/;
export function parseQuantity(input:string,allowNegative=false):QuantityMills {
  const match=DECIMAL.exec(input);
  if(!match)throw new Error('Quantity requires up to 3 fractional digits');
  const n=BigInt(match[2])*1000n+BigInt((match[3]||'').padEnd(3,'0')||'0');
  if(match[1]&&!allowNegative)throw new Error('Negative quantity not permitted');
  return match[1]?-n:n;
}
export function formatQuantity(mills:QuantityMills):string {
 const sign=mills<0n?'-':'';const absolute=mills<0n?-mills:mills;
 return `${sign}${absolute/1000n}.${String(absolute%1000n).padStart(3,'0')}`;
}
export function multiplyPriceByQuantity(unitPriceCents:bigint,quantityMills:QuantityMills):bigint {
 if(quantityMills<0n)throw new Error('Use explicit credit records for negative quantities');
 const n=unitPriceCents*quantityMills,sgn=n<0n?-1n:1n,abs=n<0n?-n:n;
 return sgn*((abs+500n)/1000n);
}
