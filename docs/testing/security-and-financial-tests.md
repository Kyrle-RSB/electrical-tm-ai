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
