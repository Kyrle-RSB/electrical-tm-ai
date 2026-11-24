# Electrical Contractor Time & Materials AI Tool (Fork B)

> **ACTIVE PHASE 2 CONSTRUCTION SOURCE. NOT A RELEASE. SYNTHETIC TEST RECORDS ONLY.**

An open-source, single-company, single-operator local Electron application in development. The intended V1 captures labor/materials, maintains deterministic invoice allocations and printable documents, and optionally adds Claude receipt extraction and owner-approved Gmail sending. This branch increment implements verified local foundation components and schema groundwork. Full contractor workflows, live integrations and public release remain unfinished.

## Status (active construction increment, 2026-11-23)

- Product choices D01–D18 and the canonical 239-path repository architecture are owner-approved.
- The owner independently observed a **prior** source revision launch as a packaged macOS app, with SQLite, health, image and synthetic PDF checks. **This newly changed construction source is not yet Mac or Windows verified.**
- `packages/persistence-sqlite`, `asset-vault`, `pdf`, `backup`, typed contracts and guarded IPC have actual source and Linux Node verification tests.
- The current construction adds migrations 0002–0004, business/profile IPC, project archive/reopen, exact arithmetic and material-split helpers, and consent-based PDF proof replacement. Tests execute in Linux Node 22.16, not native Electron. An internal test data profile is separate from the older owner Mac proof.
- No production invoicing engine, Claude integration, Gmail connection, automatic receipt extraction, multiuser sync, published release or Mac/Windows certification is claimed here.

## Local source probe (developers only)

Install Node 24+ (the owner also used Node 26 successfully) and use the exact pinned pnpm version from root `package.json`, then from repository root:

```sh
npx --yes pnpm@12.21.0 install --frozen-lockfile
npx --yes pnpm@12.21.0 proof:compile
npx --yes pnpm@12.21.0 proof:run
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start
```

The lockfile is included. Re-run all tests on your target machine before relying on the build. In the 2026-11-23 continuation, **50/50** bounded Node/SQLite tests passed on Linux Node 22.16.0 using available TypeScript tooling. The project targets Node 24+ and requires separate native Mac and Windows proof on this new revision.

Electron runtime and packaging candidates:

```sh
pnpm --filter @electrical-tm/desktop package
pnpm --filter @electrical-tm/desktop make
```

Inspect `docs/testing/clean-machine-install.md` for the gated OS tests before concluding these commands work. Do not publish any output until signing, security, financial and novice install gates have passed.

## Architecture

`React renderer → sandboxed preload → guarded main IPC → application ports → domain/SQLite/document services`. Only approved main-process operations reach the local filesystem or OS credential protection. No permanent HTTP server, user accounts, or remote synchronization.

### Fork separation

Fork B is the local single-user app. Fork A is the separate native Preonera field-to-office feature program. Do not import multi-tenant, mobile sync or hosted requirements into Fork B.

### Documents

- `docs/architecture/overview.md`: security and service boundaries
- `docs/phase-1/evidence/`: observed outputs and remaining verification gates
- `docs/testing/clean-machine-install.md`: physical Mac/Windows proof runbook
- Reconciled baseline delivered in the enclosing evidence package remains the 135/195/54/76 source of truth

**The source is public under MIT; this development build is NOT a verified release for billing use.**

## Phase 2 construction status (current source increment)

This branch now includes additional, locally tested primitives for decimal quantity and effective-date labor-rate snapshots; a serialized local operation queue protecting backup consistency; a selected backup-folder preference; managed image verification; content-addressed immutable PDF storage; synthetic PDF confirmed replacement; project edit/archive; a compact OS-themed cockpit shell and nonmodal help; structured startup receipts; and CI/native-smoke definitions. **None of these untested packaged features are claimed verified on Mac/Windows in this source revision.**

Additional documentation:

- `docs/user/install-macos.md`, `docs/user/install-windows.md`: explicit source verification and eventual installer requirements
- `docs/user/backups-restore.md`: folder selection, integrity, rescue and restoration
- `docs/user/privacy-secrets.md`: data protection and exact credential limitations
- `docs/user/troubleshooting.md`: observed Forge/Vite/CSP/SQLite failure modes
- `docs/testing/acceptance-matrix.md`: Phase 2 30-case matrix; native cases remain open
- `docs/releases/RELEASE-CHECKLIST.md`: formal release hard stops


## Native proof for the current construction revision

Run `node scripts/capture-native-proof.mjs --plan` to inspect the native test commands,
then `node scripts/capture-native-proof.mjs --execute` on a supported Mac arm64 or
Windows x64 development machine. The packaged smoke verifies the synthetic
application path, protected OS credentials and backup/restore without involving
customer data. **All phase-level acceptance gates remain open** until native
evidence, independent reviews and owner acceptance are returned and audited.

The GitHub source repository is public; do not commit credentials, real customer
records, unsanitized machine evidence or private internal planning archives.
