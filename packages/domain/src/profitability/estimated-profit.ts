import {type Cents} from '../shared/money';
/** Estimation only. Never label gross billing spread as GAAP/IFRS net profit. */
export function estimatedProfit(input:{
  materialCostCents:Cents;materialSellCents:Cents;
  laborBillCents:Cents;fullyBurdenedLaborCostCents:Cents;
  otherRevenueCents?:Cents;otherDirectCostsCents?:Cents;allocatedOverheadCents:Cents
}):{materialSpreadCents:Cents;laborSpreadCents:Cents;estimatedProfitCents:Cents}{
 const a=input.materialSellCents-input.materialCostCents;
 const b=input.laborBillCents-input.fullyBurdenedLaborCostCents;
 return {materialSpreadCents:a,laborSpreadCents:b,
  estimatedProfitCents:a+b+(input.otherRevenueCents??0n)-(input.otherDirectCostsCents??0n)-input.allocatedOverheadCents};
}
