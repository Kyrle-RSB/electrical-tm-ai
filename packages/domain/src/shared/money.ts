/** Deterministic CAD-minor-unit arithmetic. No floating-point sums enter billing records. */
export type Cents = bigint;
const MONEY = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/;
export function parseMoney(value:string):Cents {
  const m=MONEY.exec(value);
  if(!m)throw new Error('Amount must be decimal currency with at most two decimal places');
  const result=BigInt(m[2])*100n+BigInt((m[3]||'').padEnd(2,'0')||'0');
  return m[1]==='-'?-result:result;
}
export function formatMoney(value:Cents):string {
  const sign=value<0n?'-':'';const abs=value<0n?-value:value;
  return `${sign}${abs/100n}.${String(abs%100n).padStart(2,'0')}`;
}
export function roundRatio(numerator:bigint,denominator:bigint):bigint {
  if(denominator<=0n)throw new Error('Invalid money divisor');
  const sign=numerator<0n?-1n:1n,absolute=numerator<0n?-numerator:numerator;
  return sign*((absolute+denominator/2n)/denominator);
}
export function multiplyDecimal(money:Cents,multiplier:string,maxFraction=4):Cents {
  const m=/^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(multiplier);
  if(!m || (m[2]||'').length>maxFraction) throw new Error('Invalid nonnegative decimal quantity');
  const scale=10n**BigInt((m[2]||'').length);
  return roundRatio(money*(BigInt(m[1])*scale+BigInt(m[2]||'0')),scale);
}
export function markedUp(cost:Cents,markupPercent:string):Cents {
  const percent = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(markupPercent);
  if(!percent)throw new Error('Invalid markup percentage');
  const points=BigInt(percent[1])*100n+BigInt((percent[2]||'').padEnd(2,'0')||'0');
  if(points>1000000n)throw new Error('Markup exceeds configured safety bound');
  return roundRatio(cost*(10000n+points),10000n);
}
export function sumMoney(values:readonly Cents[]):Cents{return values.reduce((a,b)=>a+b,0n)}

/** Guard persistence to SQLite's signed 64-bit INTEGER; BigInt calculations remain unbounded internally. */
export function assertSqliteCents(value:Cents):bigint {
 if(value<-(2n**63n)||value>2n**63n-1n)throw new Error('Money exceeds SQLite signed integer storage range');
 return value;
}
