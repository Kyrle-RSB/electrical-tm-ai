# ADR-0008: Backup location and verified recovery

**Direction:** Store local-machine backup folder preference outside the portable business data root; require owner selection and a separate directory. When backup is initiated, serialize data and attachment operations. Snapshot SQLite using its backup API, copy managed photo/PDF assets, write SHA-256 manifest, atomically publish the completed folder. Reject extra or tampered files before restoration, keep rescue copy, reopen DB, then refresh UI.

**Evidence:** current Linux Node tests for archive integrity, tampering, profile folder selection, connection rebinding and serialized writes. Native packaged restore proof on Mac/Windows is still required. No cloud sync, encryption or automated external backup service is implied.

**Rejected shortcuts:** uncoordinated copying of a live WAL database; backup into data directory; restoring without manifest verification; trusting file extensions; deleting the rescue copy before the owner confirms.

**Limits:** non-keyed SHA-256 does not provide adversarial authenticity; users must secure backup archives. A separate OS/process may mutate local files outside this app. Single-app serialization is not a substitute for OS-level file security.

The manifest is checked against durable receipt and issued-document references inside a disposable copy of the SQLite snapshot, not only against the files listed by the manifest. Missing or altered referenced evidence blocks publication or restoration. Portable paths reject traversal, device names and case-normalized collisions. This does not authenticate a hostile rewrite of both the database and archive.
