# Security policy (engineering proof)

This repository is **not yet production-ready**. Do not enter personal, customer, bank, Gmail or paid Claude credentials. The proof accepts only a fixed fake token and synthetic data.

Security objectives: Electron renderer sandbox on, context isolation on, Node renderer integration off, restrictive local CSP, controlled navigation and popup behavior, exact sender-frame validation, allowlisted IPC, verified image import and local vault, encrypted credentials through OS-backed asynchronous safeStorage with **no plaintext fallback**, backups with content hashes, and explicit action approvals before emailing or issuing invoices.

Even a localhost app without app sign-in has a security boundary. Vulnerabilities may be reported privately to the future repository owner through a documented contact route after publication. Do not upload customer data or real keys as issues.

Known gaps: untested Electron binary, unverified macOS/Windows keychains, no signed builds, no external penetration review, no finalized receipt-image decoder, no backup cryptographic authenticity guarantee, no production data migration, no Gmail scope/consent verification, no tested update/rollback. Integrity hashes detect accidental data change but cannot authenticate an attacker-controlled backup manifest.
