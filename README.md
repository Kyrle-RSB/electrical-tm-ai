# Electrical Contractor Time & Materials

> **IN DEVELOPMENT. NOT A RELEASE. NOT FOR REAL BILLING. FICTIONAL TEST DATA ONLY.**

A local, offline desktop app (Electron, MIT licence) for a one-truck to small-crew electrical contractor: track crew time and materials against jobs, produce T&M tickets, and turn unbilled work into exact invoices. One business, one computer, no account, no server, no sync.

Where it is going: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Status

- `main` runs from source as a local foundation: projects, business profile and logo, managed photos, verified backup and restore, and a sample PDF.
- Underneath: checksum-verified SQLite migrations 0001 to 0009, guarded IPC, exact integer-cent money, dated labour rates, half-day overhead, material splits, immutable PDF storage and OS-protected credentials. Most of these have no screens yet.
- CI on `main`: 169 tests pass, plus typecheck, lint, source and secret audits, and packaged builds on macOS (arm64) and Windows (x64). Check the current commit's CI before relying on any of it; a result for one commit does not certify another.
- **Not built:** a full invoicing workflow, Claude receipt reading, Gmail sending, and multi-user sync. None of these is implemented or claimed.
- Independent security, financial, data-recovery and install reviews are still to come. No release is authorized, and no build is fit for real billing.

## Run from source (developers only)

Node 24 or newer (CI pins the exact version in `.nvmrc`). Always call pnpm through `npx` at the pinned version:

```sh
npx --yes pnpm@12.21.0 install --frozen-lockfile
npx --yes pnpm@12.21.0 test
npx --yes pnpm@12.21.0 desktop:typecheck
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start
```

Unsigned packaging candidates, for testing only:

```sh
npx --yes pnpm@12.21.0 package:mac
npx --yes pnpm@12.21.0 package:win
```

Re-run the tests on your own machine before trusting a build. Read `docs/testing/clean-machine-install.md` for the macOS and Windows install checks. Do not publish any output: signing, security, financial and install gates have not passed.

For native proof on a Mac arm64 or Windows x64 machine, `node scripts/capture-native-proof.mjs --plan` lists the steps and `--execute` runs them with synthetic data only; audit the result with `node scripts/audit-native-proof.mjs <native-evidence-directory>`. A passing smoke test alone does not meet the full native contract.

## Architecture

`React renderer → sandboxed preload → guarded main IPC → application ports → domain / SQLite / document services`. Only approved main-process operations touch the filesystem or OS credential storage. No permanent HTTP server, user accounts or remote sync.

- `docs/architecture/overview.md`: security and service boundaries
- `docs/architecture/adr/`: architecture decisions
- `docs/user/`: install, backups and restore, privacy and secrets, troubleshooting
- `docs/testing/acceptance-matrix.md`: acceptance cases; native cases remain open
- `docs/releases/RELEASE-CHECKLIST.md`: hard stops before any release
- `AGENTS.md`: commands and rules for contributors and coding agents

## Public repository

The source is public under MIT. Never commit credentials, real customer records, unsanitized machine evidence or private planning material. This development build is **not** a verified release for billing use.
