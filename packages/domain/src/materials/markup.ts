import {markedUp,assertSqliteCents,type Cents} from '../shared/money';
/** Snapshot the existing exact supplier-cost markup rule; never price from an AI suggestion. */
export function materialMarkupSnapshot(netUnitCostCents:Cents,markupPercent:string){
 if(typeof netUnitCostCents!=='bigint'||netUnitCostCents<0n)throw new Error('Invalid supplier unit cost');
 const cost=assertSqliteCents(netUnitCostCents),sell=assertSqliteCents(markedUp(cost,markupPercent));
 return Object.freeze({netUnitCostCents:cost,markupPercent,sellUnitCents:sell,estimatedSpreadCents:sell-cost});
}
