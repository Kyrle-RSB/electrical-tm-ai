# Electrical Contractor Time & Materials AI Tool (Fork B)

> **ACTIVE PHASE 2 CONSTRUCTION SOURCE. NOT A RELEASE. SYNTHETIC TEST RECORDS ONLY.**

An open-source, single-company, single-operator local Electron application in development. The intended V1 captures labor/materials, maintains deterministic invoice allocations and printable documents, and optionally adds Claude receipt extraction and owner-approved Gmail sending. This branch increment implements verified local foundation components and schema groundwork. Full contractor workflows, live integrations and public release remain unfinished.

## Status (Phase 2 construction)

- Product choices D01–D18 and the canonical 239-path repository architecture are owner-approved, including the documented Vite HTML exception. Additional implementation paths remain subject to review.
- The foundation includes checksum-verified SQLite migrations 0001–0009, guarded IPC, local profile and project operations, exact arithmetic, managed images, synthetic PDF export and immutable storage, verified backup/restore, and OS-backed fake-token protection.
- Earlier exact candidates have actual macOS ARM64 and Windows x64 automated packaged receipts. Those results do not certify a different source tree. Consult the current commit's CI and native reports, including failed stages. The strict damaged-main loader proof remains unresolved unless the exact current evidence demonstrates otherwise.
- Independent security, financial, data/recovery, release and novice host review, final canonical verification, and owner acceptance remain separate from automation. No public release is authorized.
- No production invoicing engine, Claude integration, Gmail connection, automatic receipt extraction or multiuser sync is implemented or claimed here.

## Local source probe (developers only)

For reproducible CI use Node 24.22.3 (the `.nvmrc` pin verified on both native runners) and the exact pinned pnpm version from root `package.json`, then from repository root:

```sh
npx --yes pnpm@12.21.0 install --frozen-lockfile
npx --yes pnpm@12.21.0 proof:compile
npx --yes pnpm@12.21.0 proof:run
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start
```

The lockfile is included. Re-run all tests on your target machine before relying on the build. Read the exact current pinned workflow logs for the executed test count and actual result. A local Node probe is not the pinned Electron native build or a substitute for either target OS.

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
- Original approved requirements, Phase 1 reconciliation, Phase 2 planning and acceptance controls are maintained in the private owner evidence package; do not publish that package.

**The source is public under MIT; this development build is NOT a verified release for billing use.**

## Phase 2 construction status (current source increment)

This branch now includes additional, locally tested primitives for decimal quantity and effective-date labor-rate snapshots; a serialized local operation queue protecting backup consistency; a selected backup-folder preference; managed image verification; content-addressed immutable PDF storage; synthetic PDF confirmed replacement; project edit/archive; a compact OS-themed cockpit shell and nonmodal help; structured startup receipts; and CI/native-smoke definitions. The exact current candidate must have its own native evidence. Historical native tests do not authorize final acceptance.

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
customer data. The collector additionally exercises development HMR and the strict damaged-entrypoint admission gate. Inspect its actual report and audit the extracted evidence with `node scripts/audit-native-proof.mjs <native-evidence-directory>`. A successful intact-package smoke alone does not pass the complete native contract. **All phase-level acceptance gates remain open** until native
evidence, independent reviews and owner acceptance are returned and audited.

The GitHub source repository is public; do not commit credentials, real customer
records, unsanitized machine evidence or private internal planning archives.
