# Phase 2 security, finance and recovery verification

Automated Node test commands from the repository root:

```sh
npx --yes pnpm@12.21.0 install --frozen-lockfile
npx --yes pnpm@12.21.0 test
node scripts/audit-source-secrets.mjs
node scripts/verify-licenses.mjs
node scripts/audit-requirements.mjs
```

Main financial examples are **fully burdened labor cost** and **estimated material spread**, minus **allocated daily overhead**. For $300 estimated daily overhead with one project assigned half a day, $150 is allocated and $150 remains unallocated. No automatic allocation for more than two combined half-days is owner-approved; the engine must reject that scenario instead of guessing.

Security checks include untrusted IPC senders, malformed payloads, managed asset traversal, forged/tampered backups, fail-closed mock vault, production CSP, and no unapproved file overwrite. Real OS Keychain/DPAPI, packaged UI, multi-step restore and Windows behaviors need their own signed native evidence receipts. Tests specify expected and observed facts, not a claim that release authorization exists.

The managed-image tests reject linked source and vault files, and retain the original between-check-and-open substitution regression. Immutable PDF duplicate verification covers bounded short reads. Export tests cover redirected destination directories and same-size staged-byte tampering; the previous export must remain unchanged. The lifecycle runner must use a private current-user POSIX temporary profile; Windows ACL isolation still requires native security review. These checks do not eliminate every arbitrary concurrent same-user filesystem race or certify independent acceptance.

The restore consent regression replaces the selected archive with another valid synthetic backup during confirmation. Restore must reject and preserve the latest projects. Credential regressions force short reads and revoke during asynchronous decryption requesting rotation; no revoked record may be returned or recreated. PDF adversarial hooks use physical parent identity and assert the attack was actually injected on each platform.

The real-upgrade interruption test starts a child using the original migration SQL and real LocalStore, pauses after executing the next migration inside BEGIN IMMEDIATE before receipt commit, and kills that process. It checks old schema and row identity, rescue checksum/history, exact final migration checksums, SQLite integrity and a no-op reopen. It runs on the target-host pinned suite, not just a hand-authored SQL transaction.

Native collector contract 6 adds a strict renderer security receipt: exact method census and foreign-window SECURITY results, nine main-frame VALIDATION results, unchanged synthetic data/file census, actual isolated window preferences, and CSP/window/navigation/permission denials. Missing or incomplete receipt fields fail the new collector; earlier archived contracts retain their historical semantics. No test-only raw renderer IPC bridge is added.

AC17 raw-argument characterization tests reject an otherwise valid mutation envelope with extra transport arguments, preserve sanitized sender-denial responses if diagnostics fail, and check the fixed registration allowlist and replay rejection. AC05 target-policy tests reject packaged development-URL contamination and invalid development schemes/origins before navigation. These local tests do not replace actual native transport/port proof.

Native contract 9 adds raw IPC invocation receipts from a separate synthetic fixture window with an actual same-origin child, cross-origin child and wrong top URL. The fixed sandboxed test preload is not a production bridge. The exact channel census, malformed argument/envelope, replay, oversize, cyclic and native unknown-channel denials must match expected results; all logical database tables and managed roots must remain unchanged. A local VM execution of the exact fixture program exercises the real registrar/SQLite boundary but is explicitly not native evidence. Ordinary packaged smoke separately requires an actual occupied port-5173 loopback trap with zero connections; invalid native renderer load must fail rather than report a synthetic success. Earlier native contracts retain their original audit requirements.

Managed-image and credential staging fault injection now covers a partial write, an observed redirected image directory, same-length ciphertext corruption before activation and an exclusive-create collision containing unrelated bytes. Each test asserts actual injection, no acknowledged invalid import/update, prior credential bytes preserved, and safe cleanup or retention. A retry of the interrupted image import independently verifies the original content hash. Portable Node file APIs do not eliminate all same-account directory replacement races; independent review remains mandatory.

The restore double-failure test injects both stage activation and original rollback rename failures at the actual registered restore route. It requires zero reopen attempts, fatal recovery, intact original and verified stage, and refusal to create missing active data on startup. Recovery is demonstrated only in a disposable fixture by deliberately returning the original rescue. The adjacent happy path, ordinary first launch and failed-rebind tests remain required.

Native contract 10 requires actual packaged readiness in at most 15000 ms of main-process uptime, observed title, rendered React root dimensions and IPC health. The hidden automation window is not physical display evidence. The native interrupted-restore fixture moves the isolated seeded active directory to a rollback sibling, launches the actual marked package, requires exit 1 and redacted `paths.prepare` failure before SQLite open, verifies the rescue census unchanged, and returns the original in the disposable test only. It is not a substitute for an independently witnessed interrupted restore.

Backup-location regressions cover multiply-linked and oversized settings, redirected settings directories, exclusive-create collisions, same-size stage tampering, partial writes and bounded short reads. Previous selection bytes and unrelated objects must survive refusal. The original version-1 preference and external-folder checks remain unchanged.

Native evidence audit requires exact regular-file manifest coverage, recognized contracts, consistent step exits, and current-contract host, zero-skip regression summary, artifact identities and untouched manual-review template. Screenshot pixels must be consistent with the requested logical viewport (uniform display scaling, at most fourfold). These checks reject incomplete or internally inconsistent evidence, not a forged complete delivery. Verify actual package bytes and Git/source identities independently; never substitute this audit for manual and independent acceptance.

The source secret scanner now screens known signatures in regular files including binary bytes and formerly skipped large text, refuses an unsafe/unreadable or over-16 MiB input rather than silently passing it, and has synthetic redaction/admission tests. Native workflow uploads of evidence (including failed receipts) depend on a separate successful screening of the exact native evidence directories; CI failure-evidence uploads are similarly gated. No raw credential value is returned. This does not guarantee detection of arbitrary credentials, encrypted/compressed payloads, customer data, or text rendered in screenshots. Actual archive privacy inspection and qualified independent release/security review remain mandatory; internal unsigned packages are not public releases.
