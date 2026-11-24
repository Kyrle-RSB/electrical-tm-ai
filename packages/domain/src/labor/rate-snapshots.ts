import {parseMoney,multiplyDecimal,formatMoney,assertSqliteCents} from '../shared/money';
import {isCalendarDay,requireCalendarDay} from '../shared/clock';
/** Effective-date snapshot. Changing a worker rate never changes a historic entry. */
export type RateVersion={id:string;workerId:string;effectiveDay:string;billHour:string;fullyBurdenedCostHour:string};
export function snapshotLaborRate(versions:readonly RateVersion[],workerId:string,workDay:string,hours:string){
 requireCalendarDay(workDay);
 const applicable=versions.filter(v=>v.workerId===workerId&&isCalendarDay(v.effectiveDay)&&v.effectiveDay<=workDay)
   .sort((a,b)=>b.effectiveDay.localeCompare(a.effectiveDay));
 if(!applicable.length)throw new Error('No effective rate for worker and date');
 if(applicable.length>1&&applicable[0].effectiveDay===applicable[1].effectiveDay)throw new Error('Ambiguous rate version');
 const rate=applicable[0],billHourly=parseMoney(rate.billHour),costHourly=parseMoney(rate.fullyBurdenedCostHour);
 if(billHourly<0n||costHourly<0n)throw new Error('Negative labor rate');
 assertSqliteCents(billHourly);assertSqliteCents(costHourly);
 const billCents=assertSqliteCents(multiplyDecimal(billHourly,hours)),costCents=assertSqliteCents(multiplyDecimal(costHourly,hours));
 return {workerId,workDay,hours,rateId:rate.id,billHourlyCents:billHourly,costHourlyCents:costHourly,
  billCents,costCents,estimatedLaborSpreadCents:billCents-costCents,
  summary:`${formatMoney(billCents)} billed, ${formatMoney(costCents)} estimated burdened cost`};
}
