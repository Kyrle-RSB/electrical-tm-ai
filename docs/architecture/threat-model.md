# Fork B Phase 2 security threat model

| Threat / failure | Current defense | Remaining proof / limitation |
|---|---|---|
| Compromised React renderer | Sandboxed preload, context isolation, no Node integration, fixed IPC allowlist, versioned envelopes, process-scoped replay rejection, strict sender+top-frame URL validation | Native malicious-frame and navigation tests, independent audit |
| Arbitrary local files read/written | OS-native file dialogs, managed vault paths and image MIME/header/size/hash checks | Fuzzing of forged PDFs/images, symlink-race review |
| Provider credential exposed | Async OS safeStorage only, encrypted bytes at rest, no plaintext fallback, provider alias allowlist | Native Keychain/Windows DPAPI test, independent review |
| Database partial write | SQLite BEGIN IMMEDIATE and rollback, STRICT/FK/immutability rules, migration checksum history | Cross-process crash/restart, actual Electron driver safety |
| Backup races with writes | Single-process local operation queue serializes imports, mutations, and snapshot/restore | Multi-process lock not supported; enforce single Electron instance |
| Backup tampering | SHA-256 file/size manifest, extra-file rejection, offline SQLite integrity verification, rescue copy | Manifest not cryptographically signed; protects accidental corruption, not hostile re-signing |
| PDF overwrite | Synthetic external export requires explicit confirmation, canonical path exclusion of managed profile data (including alias paths), staged replacement; immutable issued PDF bytes use content-addressed `wx` | Windows/macOS packaged Replace tests |
| Window stays blank after a build | Named Vite entries, proper HTML root, safe dev CSP only, startup stage logs, native packaged smoke | Packaged smoke must run for exact revision |
| Cross-tenant access | V1 has no tenants or network servers; one OS user is local authority | Same-OS-account malware and machine theft are not mitigated by an app login |

Never ship real credentials, client documents, private tokens or backups in the MIT source tree. No secret or external provider call is required for normal foundation operations.

The path checks reject existing alias paths and unsafe overlap; they do not claim protection against arbitrary malicious processes running as the same OS user and racing directory replacement. Backups remain hash-integrity checked, not authenticated signatures. Independent security review and physical-machine proof remain required.
