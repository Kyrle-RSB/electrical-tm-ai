import {assertSqliteCents,type Cents} from '../shared/money';
/** Estimation only. Never label gross billing spread as GAAP/IFRS net profit. */
export function estimatedProfit(input:{
  materialCostCents:Cents;materialSellCents:Cents;
  laborBillCents:Cents;fullyBurdenedLaborCostCents:Cents;
  otherRevenueCents?:Cents;otherDirectCostsCents?:Cents;allocatedOverheadCents:Cents
}):{materialSpreadCents:Cents;laborSpreadCents:Cents;estimatedProfitCents:Cents}{
 // Negative input adjustments require the separate explicit credit/adjustment contract.
 // A genuine negative result (a loss) remains valid; never clamp it to zero.
 const nonnegative=(value:Cents):Cents=>{
   if(typeof value!=='bigint'||value<0n)throw new Error('Estimated profit requires complete nonnegative integer-cent inputs');
   return assertSqliteCents(value);
 };
 const a=nonnegative(input.materialSellCents)-nonnegative(input.materialCostCents);
 const b=nonnegative(input.laborBillCents)-nonnegative(input.fullyBurdenedLaborCostCents);
 const revenue=nonnegative(input.otherRevenueCents===undefined?0n:input.otherRevenueCents);
 const costs=nonnegative(input.otherDirectCostsCents===undefined?0n:input.otherDirectCostsCents);
 const overhead=nonnegative(input.allocatedOverheadCents);
 return {materialSpreadCents:a,laborSpreadCents:b,
  estimatedProfitCents:assertSqliteCents(a+b+revenue-costs-overhead)};
}
