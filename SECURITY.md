# Security policy (engineering proof)

This repository is **not yet production-ready**. Do not enter personal, customer, bank, Gmail or paid Claude credentials. The proof accepts only a fixed fake token and synthetic data.

Security objectives: Electron renderer sandbox on, context isolation on, Node renderer integration off, restrictive local CSP, controlled navigation and popup behavior, exact sender-frame validation, allowlisted IPC, verified image import and local vault, encrypted credentials through OS-backed asynchronous safeStorage with **no plaintext fallback**, backups with content hashes, and explicit action approvals before emailing or issuing invoices.

Even a localhost app without app sign-in has a security boundary. Report vulnerabilities privately to the repository owner; do not expose exploit details, customer data or keys in a public issue. Do not upload customer data or real keys as issues.

Known limits: earlier exact candidates have actual native packaged and fake-token safeStorage automation, not independent physical OS-vault or release acceptance. Verify each new candidate, including native failure receipts. Portable file/directory identity checks are not an atomic cross-process lock against a malicious process with the same OS account. Independent native ACL/reparse-point and residual filesystem review is mandatory. No signed builds, independent penetration review, finalized receipt-image extraction, backup cryptographic authenticity guarantee, production data migration, Gmail scope/consent verification or release update/rollback certification. Integrity hashes detect accidental data change but cannot authenticate an attacker-controlled backup manifest.
