# ADR-0009: Cross-platform packaging and controlled release

**Chosen:** Electron + Forge, React, TypeScript, SQLite; `pnpm@12.21.0`, hoisted node linker. Explicit `main.cjs`/`preload.cjs` Vite outputs and `apps/desktop/index.html` for the renderer page. The current HTML location is a **one-file proven exception requiring final owner ratification** against the approved 239-path catalog. No other folder ownership is changed.

**Regression strategy:** source typecheck/test, actual generated packages, isolated `--tm-smoke` application health+renderer+SQLite test, separate native macOS/Windows clean-install proof, provider-vault test, restore test, novice installation, independent security review. A CI runner proves CI behavior only; it is not evidence of an uncoached contractor installation.

**Not authorized:** unsigned binaries advertised to contractors; automatic publishing; silently disabling Gatekeeper or SmartScreen; assuming macOS pass means Windows pass; automatic updates or running migrations on real business data before proven backup/recovery.

## Narrow catalog extensions requiring register reconciliation

* `apps/desktop/tsconfig.json`: necessary child project settings extending the approved `tsconfig.base.json`.
* `packages/persistence-sqlite/src/migrations/0005-evidence-integrity.sql`: append-only financial invariants; never change historical 0001-0004 migrations.
* Additional automated test files and GitHub pull request template, preserving their existing package owner/type boundaries.

These are additive implementation files, **not changes to tenant scope, runtime, financial authority or module ownership**. The independent architecture auditor must still reconcile them against the owner-approved 239-path register. The one-file Vite HTML root exception remains awaiting explicit owner decision.
