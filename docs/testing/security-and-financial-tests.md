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
