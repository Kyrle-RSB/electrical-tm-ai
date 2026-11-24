# Open-build journal: Fork B, active construction

This is an incremental implementation, **not a claim that Phase 2 or later phases are complete**.

## Current increment
- Preserved the Mac-tested Phase 1 Electron source as the baseline.
- Implemented numeric, checksum-verified SQLite migrations 0002–0004 without changing 0001.
- Added exact money, material quantity splitting, fully burdened labor contribution and half-day overhead helpers with deterministic local tests.
- Added typed IPC channels and React controls for synthetic business setup and project archive/reopen.
- Added a consent-driven replacement path for synthetic PDF exports; issued financial documents remain immutable.
- Isolated the new internal construction data profile from the owner's earlier Phase 1 proof.

## Evidence boundaries
- `tsc --project tsconfig.probe.json`: compiled in this Linux container.
- `node --test dist-probe/tests/...`: 26/26 executed and passed on Node 22.16 Linux. SQLite is experimental in this runtime.
- **Not executed on this source revision:** actual Mac or Windows packaged Electron, real OS keychain protection, clean novice install, full customer invoice, live Claude/Gmail, independent review.

## Decision continuity
D01–D18, D14 burdened labor and unused half-day overhead remain approved. Exact Vite HTML path difference is an existing working exception that still needs owner disposition. The original 195-item Phase 1 gate and the Phase 2 sign-offs are NOT certified.

## Phase 2 source construction increment

Owner requested building all phases in ChatGPT, not recursive planning exercises. In this increment, existing Electron/React/SQLite code was preserved while adding bounded implementation and negative tests: secure source scanning and CI definitions; process startup receipts and packaged smoke; serial app operations; schema rescue; financial amount/quantity/rate/overhead calculations; immutable stored PDFs, payment and credit guards; project edit/archive and responsive shell; backup-folder preferences; preflight restoration and in-app help. The source remains internal, with native Mac/Windows and independent verification pending. See `iteration-template.md` for the public-safe record format used for later iterations.
