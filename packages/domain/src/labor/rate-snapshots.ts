import {parseMoney,multiplyDecimal,formatMoney} from '../shared/money';
/** Effective-date snapshot. Changing a worker rate never changes a historic entry. */
export type RateVersion={id:string;workerId:string;effectiveDay:string;billHour:string;fullyBurdenedCostHour:string};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export function snapshotLaborRate(versions:readonly RateVersion[],workerId:string,workDay:string,hours:string){
 const date=new Date(`${workDay}T00:00:00Z`);
 if(!DAY.test(workDay)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==workDay)
   throw new Error('Invalid work day');
 const applicable=versions.filter(v=>v.workerId===workerId&&DAY.test(v.effectiveDay)&&new Date(`${v.effectiveDay}T00:00:00Z`).toISOString().slice(0,10)===v.effectiveDay&&v.effectiveDay<=workDay)
   .sort((a,b)=>b.effectiveDay.localeCompare(a.effectiveDay));
 if(!applicable.length)throw new Error('No effective rate for worker and date');
 if(applicable.length>1&&applicable[0].effectiveDay===applicable[1].effectiveDay)throw new Error('Ambiguous rate version');
 const rate=applicable[0],billHourly=parseMoney(rate.billHour),costHourly=parseMoney(rate.fullyBurdenedCostHour);
 if(billHourly<0n||costHourly<0n)throw new Error('Negative labor rate');
 const billCents=multiplyDecimal(billHourly,hours),costCents=multiplyDecimal(costHourly,hours);
 return {workerId,workDay,hours,rateId:rate.id,billHourlyCents:billHourly,costHourlyCents:costHourly,
  billCents,costCents,estimatedLaborSpreadCents:billCents-costCents,
  summary:`${formatMoney(billCents)} billed, ${formatMoney(costCents)} estimated burdened cost`};
}
