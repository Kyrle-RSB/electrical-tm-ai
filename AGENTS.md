# electrical-tm-ai: agent instructions

Owner: the Electrical lead. Last reviewed: 2026-11-28.

## 1. What this repo is
A local, offline Electron app for a one-truck to small-crew electrical contractor: time and materials, T&M tickets and invoices.
Public, MIT, in development; not a release and not for real billing.

## 2. Before you start
- How we work: ~/dev/00 Operating Model/OPERATING-MODEL.md
- This project's path to done: ~/dev/00 Operating Model/projects/electrical/CHECKLIST.md
- Your task brief names the item you are working on.

## 3. Commands
From the repo root, Node 24+. Always call pnpm as `npx --yes pnpm@12.21.0`; plain `pnpm` is broken here.
- Install: `npx --yes pnpm@12.21.0 install --frozen-lockfile`
- Typecheck: `npx --yes pnpm@12.21.0 desktop:typecheck` and `npx --yes pnpm@12.21.0 proof:typecheck`
- Test, full: `npx --yes pnpm@12.21.0 test`
- Source quality: `npx --yes pnpm@12.21.0 quality:source`
- Structure audit: `node scripts/audit-repo-structure.mjs`
- Run locally: `npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start`
- Package: `npx --yes pnpm@12.21.0 package:mac` and `npx --yes pnpm@12.21.0 package:win`
- On the Mac, full tests and packaging go through `heavy` at low priority, one at a time: `heavy nice -n 10 npx --yes pnpm@12.21.0 test`
- Deploy or release: none. Publishing a build is reserved for Kyrle, see section 4.
- CI (`.github/workflows/ci.yml`) must be green before merge.

## 4. Hard rules
- Fictional data only, including screenshots and fixtures. Why: the repo is public. Since: 2026-11-28.
- Money is integer cents, computed only through `packages/domain`. Why: every dollar must be exact and traceable. Since: 2026-11-28.
- A new dependency needs an ADR in `docs/architecture/adr/` first. Why: `CONTRIBUTING.md` requires it. Since: 2026-11-28.
- A schema change is a new migration file; never edit an existing migration. Why: existing local databases must upgrade safely. Since: 2026-11-28.
- An issued invoice is never changed, only credited with a credit note. Why: invoices are legal records. Since: 2026-11-28.
- One PR per checklist item, merged to `main` the same day when green. Why: small reviewable steps. Since: 2026-11-28.
- Never use `git --no-verify`. Why: the checks are the safety net. Since: 2026-11-28.
- Never open `.env` or any secret file, and never commit a key, token or password. Why: the repo is public. Since: 2026-11-28.
- Reserved for Kyrle: any real client or business data; turning on Claude receipt reading or Gmail sending; code signing or any paid account; publishing a release, demo video or post; installing a build for real billing. Do not work around these. Since: 2026-11-28.

## 5. Where things are
- `apps/desktop`: the Electron app (main, preload, React renderer, Forge and Vite config)
- `packages/domain`: pure business rules (money, labour, materials, invoices, overhead)
- `packages/contracts`: typed IPC channels and schemas shared by main and renderer
- `packages/application`: use cases and ports that join domain to storage
- `packages/persistence-sqlite`: SQLite connection, migrations (`src/migrations/`), repositories
- `packages/asset-vault`: verified image import and managed local files
- `packages/pdf`: invoice, receipt and sample PDF rendering and storage
- `packages/backup`: backup and restore
- `tests/`: `unit`, `integration`, `security`, `foundation`, `platform` (install runbooks), `fixtures` (fictional only)
- `scripts/`: test runner, audits, fixture and smoke scripts
- `docs/architecture`: overview, data model, finance, IPC, threat model; ADRs in `adr/`
- `docs/user`: user guides
- `docs/releases`: the release checklist
- `docs/build-journal`: past build history

## 6. Read when needed
- Before a database change: `docs/architecture/data-model.md`
- Before touching money: `docs/architecture/finance.md`
- Before an IPC or security change: `docs/architecture/ipc-contracts.md` and `docs/architecture/threat-model.md`
- Before packaging or a release: `docs/releases/RELEASE-CHECKLIST.md` and `docs/testing/clean-machine-install.md`
