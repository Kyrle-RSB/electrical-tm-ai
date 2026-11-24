# ADR-0008: Backup location and verified recovery

**Direction:** Store local-machine backup folder preference outside the portable business data root; require owner selection and a separate directory. When backup is initiated, serialize data and attachment operations. Snapshot SQLite using its backup API, copy managed photo/PDF assets, write SHA-256 manifest, atomically publish the completed folder. Reject extra or tampered files before restoration, keep rescue copy, reopen DB, then refresh UI.

**Evidence:** local and pinned CI tests for archive integrity, tampering, profile folder selection, connection rebinding and serialized writes. Earlier c5f9936 packaged proof succeeded on both native targets; latest revisions add database-reference/asset completeness and failed-rebind recovery. Exact final-source native receipts and independent recovery witnesses remain required. No cloud sync, encryption or automated external backup service is implied.

**Rejected shortcuts:** uncoordinated copying of a live WAL database; backup into data directory; restoring without manifest verification; trusting file extensions; deleting the rescue copy before the owner confirms.

**Limits:** non-keyed SHA-256 does not provide adversarial authenticity; users must secure backup archives. A separate OS/process may mutate local files outside this app. Single-app serialization is not a substitute for OS-level file security.

The manifest is checked against durable receipt and issued-document references inside a disposable copy of the SQLite snapshot, not only against the files listed by the manifest. Missing or altered referenced evidence blocks publication or restoration. Portable paths reject traversal, device names and case-normalized collisions. This does not authenticate a hostile rewrite of both the database and archive.

Migration 0007 adds a distinct local business logo reference using the existing managed image vault. Verify backup completeness against this reference as well as receipts and issued documents. No historical migration bytes were edited.

The main-process confirmation captures a canonical SHA-256 identity of the validated manifest, including file paths, sizes and content hashes. Restore re-verifies the selected archive against that identity before staging or moving active data; a different valid archive is not a valid substitute after consent. Staged bytes are rechecked against both recorded length and hash. This is content binding, not a cross-process filesystem lock.
