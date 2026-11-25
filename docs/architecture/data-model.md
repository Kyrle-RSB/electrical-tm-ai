# SQLite v1 foundation and additive migrations

`0001-initial.sql` remains unmodified, with original checksum validated at startup. Additive migrations 0002–0004 are loaded in numeric sequence, each within its own `BEGIN IMMEDIATE` transaction. Unknown or modified migrations prevent startup rather than silently editing business records. `PRAGMA quick_check` and `PRAGMA foreign_key_check` run after migrations.

- **0002:** one-business settings, project details/status, source document and material-disposition draft structures.
- **0003:** day-level estimated overhead, half-day project assignments and versioned bill-out/fully burdened cost rate snapshots.
- **0004:** editable invoice drafts, immutable issued invoice/receipt snapshots, payment events, credit notes and outgoing email drafts.

**Warning:** These later-phase tables are schema foundations, NOT fully implemented invoice/payment workflows. Production integration/forward migrations must have a backup-before-upgrade and migration rollback procedure that has not yet passed packaged testing.

Construction builds use an isolated Electron user-data profile (`ElectricalTMCockpit-P2-Internal`) to avoid mutating the owner's earlier Phase 1 macOS proof records.

Test evidence: `tests/integration/sqlite-ledger.test.ts`, `tests/integration/invoice-immutability.test.ts`.

## Phase 2 implementation addendum: append-only migration 0005

Migration `0005-evidence-integrity.sql` **adds** triggers preventing mutations of issued credit notes, recorded payments, and approved outbound messages. It also checks cumulative material dispositions against purchase-line quantity and rejects calendar overhead entries that exceed two half-day units. The existing 0001–0004 migration files and their recorded hashes are unchanged. A future business correction requires an explicit reversal or new financial event, not hidden changes to an issued record.

`LocalStore` now creates a verified SQLite `VACUUM INTO` rescue copy before upgrading a populated prior-version schema. A changed migration checksum aborts startup. Restoration independently checks manifest hashes, SQL integrity, historical migration compatibility and a disposable schema upgrade **before** replacing active data, with a rescue copy of the former data root. This is tested using synthetic Node SQLite, not yet on packaged Mac/Windows for this exact revision.

Migration 0008 adds an optional bounded `audit_events.reason` column. The original 0001–0007 bytes and historical audit rows remain untouched; null means no recorded historical reason. New operator archive/reopen actions save their explicit reason in the same transaction as status, audit and mutation receipt. Existing typed calls without a reason are supported with operation-only metadata (not a fabricated business justification).
