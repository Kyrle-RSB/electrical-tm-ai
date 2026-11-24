# Deterministic financial arithmetic (Fork B)

**Implementation status:** Exact-arithmetic primitives and narrow tests exist. Full invoices, taxes, payroll, inventory and payment processing are NOT built or certified.

- Persist and sum currency in integer minor units, not JavaScript floating-point dollars.
- Decimal quantity multiplication rounds to currency minor units using explicitly coded half-away-from-zero rounding. Negative adjustments need an audited credit flow.
- Markup is applied to supplier net unit cost. Markup percentage and gross margin are distinct.
- Labor contribution estimate equals customer labor bill-out minus **fully burdened** estimated employee hourly cost. It is not payroll accounting.
- Estimated profit equals material resale spread + labor spread + other revenue - other direct costs - allocated daily overhead; label every output **Estimated Profit**.
- The approved overhead capacity example is $300/day and one half-day job = $150 assigned and $150 **unallocated**. Two separate half-day jobs each receive $150.
- The general rule when recorded project workload exceeds two half-day slots on one calendar day remains a narrow owner decision. The current pure function fails closed and never silently apportions overbooked days.
- Issued invoices and payment receipts have append-only/immutable snapshot groundwork. Actual accounting workflow tests and tax/legal review remain outstanding.

Source: `packages/domain/src/shared/money.ts`, `packages/domain/src/profitability/estimated-profit.ts`, `packages/domain/src/overhead/allocation.ts`.
Tests: `tests/unit/*`, `tests/integration/invoice-immutability.test.ts`.

### Exact cent apportionment for half-day overhead

The approved rule remains: an idle half-day retains its half of daily overhead as unallocated. The implementation uses integer cents and deterministic largest-remainder allocation when half-day shares produce fractions of a cent. It assigns any one-cent tie to the stable lexicographically smaller project ID, rather than distributing more cents than actually exist. For $300.00/day with one half-day: $150.00 allocated and $150.00 unallocated. For $0.01/day with two projects half-day each: one project receives one cent, the other zero, leaving zero unallocated. Aggregate project assignment above one full day's two half-day capacity is rejected pending a separately approved policy.
