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
