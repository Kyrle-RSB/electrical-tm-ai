# Fork B Phase 2 security threat model

| Threat / failure | Current defense | Remaining proof / limitation |
|---|---|---|
| Compromised React renderer | Sandboxed preload, context isolation, no Node integration, fixed IPC allowlist, versioned envelopes, process-scoped replay rejection, strict sender+top-frame URL validation | Packaged every-bridge-method foreign-window and CSP/navigation proof; native cross-frame raw transport is not exposed; independent audit |
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

### Descriptor-level filesystem review (Phase 2 continuation)

CodeQL PR annotations 4–12 identified check/use filesystem operations. Startup marker/receipt reads, diagnostic appends, backup manifest reads and backup source copying/hashing now validate the actual opened descriptor, enforce appropriate byte bounds, reject hardlinks where the application owns a file, and recheck observable path identity. CI source/lock provenance reads use the same descriptor discipline. Selected image and PDF reads retain their pre-open identity comparison, no-follow flags and bounded reads, and recheck named identity afterward. A successfully executed scan is not disposition of individual annotations. No alert has been dismissed by the implementing agent.

These checks mitigate observable file replacements; Node's portable API does not provide a complete OS-specific directory-handle transaction across each filesystem operation. Privileged or malicious same-account concurrent directory replacement remains an explicit limitation, not a certified invariant. An independent security reviewer must inspect the actual alerts, negative tests and release threat boundary.

Restore consent is bound to the verified content manifest; a different valid backup at the same path must be rejected. Secret rotation is bound to the observed encrypted file identity, including after asynchronous decryption/encryption; detected revocation must not recreate that record. These checks do not turn portable filesystem calls into an atomic multi-process transaction.

Packaged native security receipts now require all 22 fixed bridge denials, nine malformed input denials, unchanged synthetic logical database and managed-file census, exact Electron isolation preferences, exact packaged CSP, observed script/frame/connect blocks, and denied window/navigation and notification permission operations. A denied frame load is not a simulated raw subframe IPC request. Native proof must execute successfully on both supported hosts; the real dev HMR and independent security review remain distinct gates.

Managed image imports now capture the identities of the owned directory levels, verify the newly created descriptor and its bounded readback, and recheck observed directory/file identity before returning a locator. Credential staging likewise verifies the actual ciphertext bytes, the prior credential identity and the stage identity before replacement; exclusive-create collisions and substituted stages are not blindly deleted. The remaining portable directory-handle race limitation and independent CodeQL disposition requirement are unchanged.
