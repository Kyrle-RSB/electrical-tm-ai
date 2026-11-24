# Phase 2 objective acceptance matrix

**Execution status:** Local unit tests run in this environment are only one verification layer. None of the 30 cross-platform release cases is automatically certified by a source build.

| ID | Case | Expected result | Required environment | Current status |
|---|---|---|---|---|
| P2-AC01 | Toolchain bootstrap | Installed correct lockfile and tools without undocumented manual steps | MAC + WINDOWS | OPEN: evidence required |
| P2-AC02 | Compile/typecheck | All production layers compile; build fails on TS errors | CI + MAC + WINDOWS | OPEN: evidence required |
| P2-AC03 | Dependency graph | No cycles or prohibited renderer→Node/domain dependency | CI | OPEN: evidence required |
| P2-AC04 | Forge entrypoints | Expected `.cjs` names resolve and HTML asset present | MAC + WINDOWS | OPEN: evidence required |
| P2-AC05 | Packaged no-Vite launch | Renderer and health work with port 5173 unavailable | MAC + WINDOWS | OPEN: evidence required |
| P2-AC06 | Single-instance lifecycle | No orphan process; single-instance behavior explicit; clean restart | MAC + WINDOWS | OPEN: evidence required |
| P2-AC07 | Existing project boot | Project appears automatically with no Refresh | MAC + WINDOWS | OPEN: evidence required |
| P2-AC08 | SQLite transaction rollback | No partial rows or consumed invoice number | CI + NATIVE | OPEN: evidence required |
| P2-AC09 | Concurrent writers | Serialized/conflict handling; no duplicate allocations | CI + NATIVE | OPEN: evidence required |
| P2-AC10 | Migration safety | Reproducible version; no data loss; integrity passes | NATIVE | OPEN: evidence required |
| P2-AC11 | Failed migration | Fail closed; rescue copy; intelligible recovery route | NATIVE | OPEN: evidence required |
| P2-AC12 | Backup complete | Manifest includes all required data; outside data root | MAC + WINDOWS | OPEN: evidence required |
| P2-AC13 | Restore complete | Rescue copy, database reopened, UI reflects restored records | MAC + WINDOWS | OPEN: evidence required |
| P2-AC14 | Restore tamper | Restore rejected before active files change | MAC + WINDOWS | OPEN: evidence required |
| P2-AC15 | Vault protection | OS-protected persisted secret; fail closed if unavailable | MAC + WINDOWS | OPEN: evidence required |
| P2-AC16 | Vault revoke | No leftover credential or plaintext fallback | MAC + WINDOWS | OPEN: evidence required |
| P2-AC17 | Malicious IPC sender | Every privileged call rejected | CI + NATIVE | OPEN: evidence required |
| P2-AC18 | CSP dev/prod | Dev HMR works only with dev policy; prod CSP rejects unsafe | DEV + PACKAGED | OPEN: evidence required |
| P2-AC19 | Asset import | Good asset vaulted+hashed; bad signatures/sizes rejected | MAC + WINDOWS | OPEN: evidence required |
| P2-AC20 | PDF new filename | Readable PDF with tax+license fields; correct checksum | MAC + WINDOWS | OPEN: evidence required |
| P2-AC21 | PDF existing filename | No EEXIST raw error; approved UX and correct overwrite safety | MAC + WINDOWS | OPEN: evidence required |
| P2-AC22 | Invoice immutability boundary | Issued original unchanged; export copy vs original distinguished | CI + NATIVE | OPEN: evidence required |
| P2-AC23 | Money exactness | Expected cents and exact precision, no binary-float drift | CI | OPEN: evidence required |
| P2-AC24 | Overhead half-day | Project 150, unallocated 150; sum exactly 300 | CI | OPEN: evidence required |
| P2-AC25 | Burdened labor margin | Estimated labor contribution uses fully burdened hourly cost | CI | OPEN: evidence required |
| P2-AC26 | No provider dependency | Project/backup/data core still works | MAC + WINDOWS | OPEN: evidence required |
| P2-AC27 | Appearance & accessible controls | System-only appearance and usable focus/contrast | MAC + WINDOWS | OPEN: evidence required |
| P2-AC28 | Diagnostic safety | Actionable cause logged, no client/secret leakage | MAC + WINDOWS | OPEN: evidence required |
| P2-AC29 | Novice installation | Follows public docs with no hidden build setup | MAC + WINDOWS | OPEN: evidence required |
| P2-AC30 | Public repo hygiene | No credentials, binaries, profiles, real customer data or untracked path exception | CI + HUMAN | OPEN: evidence required |

**Evidence receipt for each case must include:** source/archive SHA, exact test command, host OS and architecture, build version, synthetic fixture/checksum, observed outcome, reviewer type, date, and whether the test was mock/unit/native/packaged/novice.

**Formal full Phase 2 acceptance:** 30/30 verified in each required environment, reviewed, with owner sign-off. Do not promote individual Node-only test passes to cross-platform PASS.

## Source traceability inventory

The following machine-readable inventory preserves each original Phase 2 task and mapped case. `implementedPaths` means file present, not behavior certified; `pendingPaths` explicitly records original implementation ownership gaps. Update in the same commit when an approved path is implemented. No private planning records are published.

```json
[
  {
    "task": "P2-F01",
    "requirements": [
      "APP-001",
      "FB-R26"
    ],
    "cases": [
      "P2-AC01",
      "P2-AC02",
      "P2-AC03",
      "P2-AC30"
    ],
    "implementedPaths": [
      "README.md",
      "LICENSE",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "PRIVACY.md",
      ".npmrc",
      "pnpm-workspace.yaml",
      "pnpm-lock.yaml",
      "package.json",
      "tsconfig.base.json",
      "eslint.config.mjs",
      "scripts/audit-repo-structure.mjs",
      "scripts/audit-source-secrets.mjs",
      ".github/workflows/ci.yml",
      ".github/workflows/security.yml",
      ".github/PULL_REQUEST_TEMPLATE.md"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F02",
    "requirements": [
      "APP-001",
      "APP-002",
      "FB-R01"
    ],
    "cases": [
      "P2-AC04",
      "P2-AC05",
      "P2-AC06",
      "P2-AC07",
      "P2-AC18",
      "P2-AC28"
    ],
    "implementedPaths": [
      "apps/desktop/src/main/index.ts",
      "apps/desktop/src/main/bootstrap.ts",
      "apps/desktop/src/main/window.ts",
      "apps/desktop/src/main/os/single-instance.ts",
      "apps/desktop/forge.config.ts",
      "apps/desktop/vite.main.config.ts",
      "apps/desktop/vite.preload.config.ts",
      "apps/desktop/vite.renderer.config.ts",
      "apps/desktop/src/renderer/main.tsx"
    ],
    "pendingPaths": [],
    "approvedExceptions": {
      "apps/desktop/src/renderer/index.html": "apps/desktop/index.html"
    }
  },
  {
    "task": "P2-F03",
    "requirements": [
      "APP-002",
      "FB-R27"
    ],
    "cases": [
      "P2-AC03",
      "P2-AC17",
      "P2-AC18"
    ],
    "implementedPaths": [
      "packages/contracts/src/index.ts",
      "packages/contracts/src/ipc/channel-map.ts",
      "packages/contracts/src/ipc/request-envelope.ts",
      "packages/contracts/src/ipc/error-envelope.ts",
      "packages/contracts/src/ipc/projects.contract.ts",
      "apps/desktop/src/main/ipc/register.ts",
      "apps/desktop/src/main/ipc/sender-guard.ts",
      "apps/desktop/src/preload/index.ts",
      "apps/desktop/src/preload/bridge.ts",
      "apps/desktop/src/preload/globals.d.ts",
      "tests/security/ipc-security.test.ts"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F04",
    "requirements": [
      "APP-003",
      "FB-R03"
    ],
    "cases": [
      "P2-AC08",
      "P2-AC09",
      "P2-AC10",
      "P2-AC11"
    ],
    "implementedPaths": [
      "packages/persistence-sqlite/src/connection.ts",
      "packages/persistence-sqlite/src/migrations/0001-initial.sql",
      "packages/persistence-sqlite/src/migrations/0002-material-dispositions.sql",
      "packages/persistence-sqlite/src/migrations/0003-overhead-profit.sql",
      "packages/persistence-sqlite/src/migrations/0004-payment-receipts-branding.sql",
      "packages/persistence-sqlite/src/transactions/unit-of-work.ts",
      "packages/persistence-sqlite/src/repos/project-repo.ts",
      "tests/integration/sqlite-ledger.test.ts",
      "apps/desktop/src/main/os/paths.ts"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F05",
    "requirements": [
      "APP-004"
    ],
    "cases": [
      "P2-AC08",
      "P2-AC09",
      "P2-AC22",
      "P2-AC23",
      "P2-AC24",
      "P2-AC25"
    ],
    "implementedPaths": [
      "packages/domain/src/index.ts",
      "packages/domain/src/shared/money.ts",
      "packages/domain/src/shared/quantity.ts",
      "packages/domain/src/labor/rate-snapshots.ts",
      "packages/domain/src/overhead/allocation.ts",
      "packages/domain/src/profitability/estimated-profit.ts",
      "packages/application/src/ports/port-types.ts",
      "tests/unit/money.test.ts",
      "tests/unit/overhead-allocation.test.ts",
      "tests/unit/estimated-profit.test.ts",
      "packages/domain/src/shared/clock.ts",
      "packages/domain/src/materials/markup.ts"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F06",
    "requirements": [
      "APP-005",
      "FB-R27"
    ],
    "cases": [
      "P2-AC15",
      "P2-AC16"
    ],
    "implementedPaths": [
      "apps/desktop/src/main/os/keychain.ts",
      "apps/desktop/src/main/ipc/handlers/settings.ts",
      "packages/application/src/ports/port-types.ts",
      "tests/security/no-secret-leak.test.ts",
      "docs/user/privacy-secrets.md"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F07",
    "requirements": [
      "APP-006",
      "FB-R18",
      "FB-R28"
    ],
    "cases": [
      "P2-AC19",
      "P2-AC20",
      "P2-AC21",
      "P2-AC22"
    ],
    "implementedPaths": [
      "packages/asset-vault/src/import-file.ts",
      "packages/asset-vault/src/verify-image.ts",
      "packages/asset-vault/src/hash.ts",
      "packages/asset-vault/src/resolve-managed-asset.ts",
      "packages/pdf/src/invoices/render-invoice.ts",
      "packages/pdf/src/common/stored-pdf.ts",
      "tests/security/asset-import.test.ts",
      "apps/desktop/src/main/os/file-dialogs.ts"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F08",
    "requirements": [
      "APP-006",
      "FB-R17",
      "FB-R28"
    ],
    "cases": [
      "P2-AC11",
      "P2-AC12",
      "P2-AC13",
      "P2-AC14"
    ],
    "implementedPaths": [
      "packages/backup/src/create-backup.ts",
      "packages/backup/src/restore-backup.ts",
      "packages/backup/src/backup-manifest.ts",
      "packages/backup/src/backup-destination.ts",
      "apps/desktop/src/renderer/features/settings/BackupLocation.tsx",
      "tests/integration/backup-restore.test.ts",
      "apps/desktop/src/main/ipc/handlers/backups.ts"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F09",
    "requirements": [
      "APP-003",
      "FB-R03",
      "PRJ-001"
    ],
    "cases": [
      "P2-AC07",
      "P2-AC26"
    ],
    "implementedPaths": [
      "packages/application/src/use-cases/projects.ts",
      "packages/persistence-sqlite/src/repos/project-repo.ts",
      "apps/desktop/src/main/ipc/handlers/projects.ts",
      "apps/desktop/src/main/ipc/handlers/settings.ts",
      "apps/desktop/src/renderer/features/projects/ProjectsPanel.tsx",
      "apps/desktop/src/renderer/features/settings/BusinessBranding.tsx",
      "packages/contracts/src/ipc/projects.contract.ts",
      "tests/e2e/cockpit-flow.spec.ts"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F10",
    "requirements": [
      "FB-R10",
      "UX-001",
      "UX-003",
      "UX-008"
    ],
    "cases": [
      "P2-AC18",
      "P2-AC27"
    ],
    "implementedPaths": [
      "apps/desktop/src/renderer/App.tsx",
      "apps/desktop/src/renderer/shell/CockpitShell.tsx",
      "apps/desktop/src/renderer/components/GlassCard.tsx",
      "apps/desktop/src/renderer/theme/tokens.css",
      "apps/desktop/src/renderer/theme/system-theme.ts",
      "apps/desktop/src/renderer/features/help/HelpDrawer.tsx",
      "docs/user/00-start-here.md"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F11",
    "requirements": [
      "APP-002",
      "FB-R02"
    ],
    "cases": [
      "P2-AC01",
      "P2-AC04",
      "P2-AC05",
      "P2-AC06",
      "P2-AC07",
      "P2-AC15",
      "P2-AC29",
      "P2-AC30"
    ],
    "implementedPaths": [
      "apps/desktop/forge.config.ts",
      ".github/workflows/package-macos.yml",
      ".github/workflows/package-windows.yml",
      "scripts/run-packaged-smoke.mjs",
      "tests/platform/macos-install.md",
      "tests/platform/windows-install.md",
      "docs/releases/RELEASE-CHECKLIST.md",
      "docs/user/install-macos.md",
      "docs/user/install-windows.md",
      "apps/desktop/assets/icon.icns",
      "apps/desktop/assets/icon.ico"
    ],
    "pendingPaths": []
  },
  {
    "task": "P2-F12",
    "requirements": [
      "APP-001",
      "DOC-001",
      "FB-R26"
    ],
    "cases": [
      "P2-AC01",
      "P2-AC02",
      "P2-AC03",
      "P2-AC26",
      "P2-AC28",
      "P2-AC29",
      "P2-AC30"
    ],
    "implementedPaths": [
      ".github/workflows/ci.yml",
      ".github/workflows/security.yml",
      "scripts/audit-requirements.mjs",
      "scripts/verify-licenses.mjs",
      "scripts/make-fixtures.mjs",
      "scripts/run-packaged-smoke.mjs",
      "docs/testing/acceptance-matrix.md",
      "docs/testing/clean-machine-install.md",
      "docs/testing/security-and-financial-tests.md",
      "docs/user/00-start-here.md",
      "docs/user/backups-restore.md",
      "docs/build-journal/iteration-template.md",
      "docs/releases/RELEASE-CHECKLIST.md"
    ],
    "pendingPaths": []
  }
]
```
