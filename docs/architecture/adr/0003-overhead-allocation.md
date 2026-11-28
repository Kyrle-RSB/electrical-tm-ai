# ADR 0003: Daily overhead half-day allocation

**Status:** Owner-approved capacity-aware baseline (November 23, 2026, D14); implementation tested; independent financial review and final Phase 2 acceptance remain open.

## Decision

Daily estimated overhead uses full-day capacity as the denominator. A $300 day with only a half-day project allocates $150 to the project and keeps $150 unallocated. One full-day project receives $300; two distinct half-day projects receive $150 each. Zero work leaves the entire day unallocated. Do not charge idle overhead to the sole active project. Allocated plus unallocated cents always equals daily overhead.

The implementation uses exact integer cents and deterministic remainder allocation; tied project shares use stable project identity ordering. Invalid or duplicate project assignments are rejected. When total recorded participation exceeds one full day (two half-day slots), the current implementation fails closed. The owner has not approved a broader simultaneous-work allocation policy; do not extrapolate this capacity rule to overbooked days or silently invent a different denominator.

## Alternatives considered

- Allocate all daily overhead to active work regardless of occupied capacity: rejected for the approved half-day example.
- Proportionally allocate overbooked days: not approved. A future change requires a separate owner decision and tests, not a rewrite of historical issued estimates.

## Evidence and scope

See `packages/domain/src/overhead/allocation.ts`, `tests/unit/overhead-allocation.test.ts`, `tests/unit/estimated-profit.test.ts`, and `tests/integration/financial-evidence-locks.test.ts`. AC24 also requires durable fixture/query evidence, CI execution and qualified independent financial review. These primitives do not certify accounting or actual invoice totals. Preserve historical snapshots and explicit adjustment rules.
