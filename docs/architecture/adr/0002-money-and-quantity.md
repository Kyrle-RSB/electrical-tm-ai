# ADR 0002: Exact money and quantity primitives

**Status:** Implemented foundation policy; qualified independent financial review remains open. Owner direction: exact invoice arithmetic, fully burdened labor cost and auditable estimated profit. This ADR records the implementation, not new owner approval or tax advice.

## Decision and boundaries

- Currency values are signed integer CAD cents (`bigint`). Parse decimal strings with at most two fractional digits; reject implicit binary-float arithmetic. Convert to SQLite signed 64-bit integer only after a checked bound, never by silent truncation.
- Quantities use integer thousandths. Normal quantities are nonnegative; negative quantities require an explicit signed adjustment/credit contract. `multiplyPriceByQuantity` rounds half away from zero at the cent boundary. The labor multiplier separately accepts a bounded decimal-string precision (default four fractional digits). The different scales are explicit, not silently converted.
- Percent markup is a bounded decimal string with two fractional digits, applied to supplier net cost; markup is not gross margin. Exact cost/sell snapshots are immutable values. Effective-date labor snapshots retain both bill-out and fully burdened cost and reject missing or ambiguous applicable rates, negative rates/hours and signed SQLite overflow at hourly and extended-amount boundaries.
- Preserve issued invoice/payment/credit records and original document hashes. Corrections are explicit future credit/adjustment records, not edits to issued evidence. Do not implement unapproved tax rules or later-phase invoice/payment processing here. Calculated amounts are estimates until appropriate business approval.
- Daily overhead uses ADR 0003, including unallocated idle capacity. The existing pure estimator computes material spread + labor spread + other revenue - other direct costs - allocated overhead, not accounting-certified net profit. Required inputs must be present, nonnegative integer cents within the SQLite range; genuine negative estimated profit remains a valid loss. Explicit credits/adjustments are separate later-phase contracts.

## Evidence and review

Implementation: `packages/domain/src/shared/money.ts`, `quantity.ts`, `clock.ts`, `packages/domain/src/materials/markup.ts`, `packages/domain/src/labor/rate-snapshots.ts`, `packages/domain/src/profitability/estimated-profit.ts`, `packages/application/src/ports/port-types.ts` and the persistence contracts. Tests: `tests/unit/money.test.ts`, `quantity.test.ts`, `rate-snapshots.test.ts`, `estimated-profit.test.ts`, `overhead-allocation.test.ts` and the SQLite financial evidence tests. Run `pnpm test` with the repository-pinned toolchain; preserve exact source, inputs, observed outputs and applicable native receipts. Independent financial review and original AC08/09/22/23/24/25 sign-off remain required. Do not infer approval from passing automated checks.

**Rollback:** Preserve historical database migrations and issued snapshots. Revert pure implementation via versioned regression tests; any change to financial meaning requires an explicit versioned owner policy and new acceptance evidence.
