# Foundation layer boundaries and current evidence

```text
[React renderer: untrusted] --exact DTOs--> [sandboxed preload allowlist]
                --> [Electron main: IPC sender + input guards]
                    --> [use cases & pure deterministic domain (foundation subset)]
                    --> [SQLite connection and migrations]
                    --> [managed image/document vault]
                    --> [PDF engine]
                    --> [backup/verified restore]
                    --> [asynchronous OS-protected credentials]
```

`Electron main` is the only process permitted to request files or secrets. No raw `ipcRenderer`, Node `fs`, SQL strings or arbitrary URL redirects are exposed to React. No permanent HTTP server. Do not import UI or Electron into deterministic financial domain code. Database and document generation cannot call Claude or Gmail to finalize invoices or payment receipts.

Initial schema (`packages/persistence-sqlite/src/migrations/0001-initial.sql`) contains **only synthetic business, project and audit proof tables**. It is not the reconciled 43-table financial design and not a committed V1 production migration. Later migrations add evidence-integrity and finance snapshot groundwork. Complete production issuance, payment/credit flows and migration/backfill review remain outstanding. Original 135 requirement/54 acceptance definitions remain source-of-truth.

SQLite core `node:sqlite` is the implemented foundation driver. The native collector exercises real Electron SQLite on macOS arm64 and Windows x64 and records the exact source and binary identity. Check receipts for the candidate, not a prior commit. Independent review remains required before release.

The synthetic PDF proof is ASCII-only and omits logo rendering and full invoice accounting. It must be replaced by a reviewed production PDF adapter before any real invoice is generated. An ASCII visual proof does not establish Unicode, multipage, tax, rounding, printing, accessibility or logo behavior.

Security threat-model limitations: no network listener, but malicious renderer, hostile PDF/image uploads, local malware/other OS users, backup replacement, rollback, and public binary trust must still be reviewed. Testing actual OS vaults and signing is mandatory.


## ADR-P2-001 accepted: Vite renderer HTML entry (Owner, reaffirmed 2026-11-24)

The owner explicitly approved retaining `apps/desktop/index.html` as the only
exception to the previously approved 239-path repository map. The production
renderer is built from this HTML entry. All other approved boundaries remain
unchanged. This is a narrow, tested path exception, **not** permission to
reorganize the rest of the repository.

The November 24 continuation uses the public canonical development repository `Kyrle-RSB/electrical-tm-ai`. The owner reaffirmed ADR-P2-001 and explicitly authorized sanitized development-source publication, not customer release. The approved entry replaces the originally catalogued renderer HTML path in the effective audit map; existing support/test paths are separately enumerated and unexpected paths fail the audit.
