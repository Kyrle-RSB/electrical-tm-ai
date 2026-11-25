# Deterministic financial arithmetic (Fork B)

**Implementation status:** Exact-arithmetic primitives and narrow tests exist. Full invoices, taxes, payroll, inventory and payment processing are NOT built or certified.

- Persist and sum currency in integer minor units, not JavaScript floating-point dollars.
- Decimal quantity multiplication rounds to currency minor units using explicitly coded half-away-from-zero rounding. Negative adjustments need an audited credit flow.
- Markup is applied to supplier net unit cost. Markup percentage and gross margin are distinct.
- Labor contribution estimate equals customer labor bill-out minus **fully burdened** estimated employee hourly cost. It is not payroll accounting. Reject missing or negative rates/hours and hourly or extended amounts that exceed signed SQLite integer storage.
- Estimated profit equals material resale spread + labor spread + other revenue - other direct costs - allocated daily overhead; label every output **Estimated Profit**. Required estimate inputs are nonnegative integer cents within storage bounds; explicit credit adjustments remain separate. A loss is a valid negative result, not a value to clamp.
- The approved overhead capacity example is $300/day and one half-day job = $150 assigned and $150 **unallocated**. Two separate half-day jobs each receive $150.
- The general rule when recorded project workload exceeds two half-day slots on one calendar day remains a narrow owner decision. The current pure function fails closed and never silently apportions overbooked days.
- Issued invoices and payment receipts have append-only/immutable snapshot groundwork. Actual accounting workflow tests and tax/legal review remain outstanding.

Source: `packages/domain/src/shared/money.ts`, `packages/domain/src/profitability/estimated-profit.ts`, `packages/domain/src/overhead/allocation.ts`.
Tests: `tests/unit/*`, `tests/integration/invoice-immutability.test.ts`.

### Exact cent apportionment for half-day overhead

The approved rule remains: an idle half-day retains its half of daily overhead as unallocated. The implementation uses integer cents and deterministic largest-remainder allocation when half-day shares produce fractions of a cent. It assigns any one-cent tie to the stable lexicographically smaller project ID, rather than distributing more cents than actually exist. For $300.00/day with one half-day: $150.00 allocated and $150.00 unallocated. For $0.01/day with two projects half-day each: one project receives one cent, the other zero, leaving zero unallocated. Aggregate project assignment above one full day's two half-day capacity is rejected pending a separately approved policy.

### Fractional source price and explicit percentage fixtures (AC23)

`extendSourceUnitPriceCents` accepts a nonnegative decimal source unit price (up to four fractional digits) and the existing quantity thousandths representation. It multiplies exact integers and rounds the extension once to minor units. Finalized `parseMoney` remains a two-decimal cents parser; no source precision is silently discarded. `percentageOfCents` takes an explicitly selected signed minor-unit base and a nonnegative decimal percentage (up to four fractional digits), then rounds once. Both require the named `HALF_AWAY_FROM_ZERO` arithmetic mode, validate signed SQLite bounds and reject malformed/unsupported inputs. The 19-whole-digit parser bound is representational safety, not a commercial or statutory limit.

Synthetic oracles include 13.3375 x 2.500 = 33.34375 -> 3334 cents, 0.005 x 3 = 0.015 -> 2 cents, and 5% of 10 cents -> 1 cent. Applying the fixture 5% to two independent 10-cent bases gives 2 cents, whereas applying it once to 20 cents gives 1 cent. This deliberately exposes the rounding-stage difference; the caller must supply the approved stage, base, rate and policy version in a later invoice contract. There is no tax engine, jurisdictional rate, implied rounding-stage selection, invoice workflow, or new tax policy here. These pure calculations do not authorize a signed credit or negative-quantity workflow. Qualified independent finance review remains required.
