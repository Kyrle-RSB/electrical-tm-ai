# Source-to-release hard stops (Fork B)

**CURRENT STATUS: NO-GO FOR PUBLIC RELEASE.** The exact construction revision has not been verified natively on macOS and Windows, and independent reviews remain outstanding.

- [ ] Canonical Git branch/commit/remote designated and verified by owner.
- [ ] Owner ratifies the one-file `apps/desktop/index.html` Vite exception.
- [ ] Frozen pnpm lockfile installs on clean supported Mac/Windows.
- [ ] Full automated suite passes; CLI security/license checks pass; no real secrets in source.
- [ ] Real packaged `--tm-smoke` exits 0 with renderer/IPC/SQLite proof on each OS.
- [ ] App opens without Vite, correctly saves and reopens projects, and closes with no orphan process.
- [ ] SQLite migrations and rollback fail closed on modified/corrupted fixtures.
- [ ] Real OS-protected credentials stored, tested across restart and revoked; no plaintext fallback.
- [ ] Synthetic image import, secure PDF save/Replace, and immutable issued artifacts verified.
- [ ] Backup includes DB+attachments; tampered backup fails; verified restore with rescue and rebind passes.
- [ ] Appearance follows OS; 200% zoom, keyboard navigation and screen-reader smoke tested.
- [ ] Installer signed/notarized as applicable; OS security warnings documented accurately.
- [ ] Uncoached novice reproduces installation and documented basic workflows on each OS.
- [ ] Independently reviewed financial, security, release and usability evidence obtained.
- [ ] Owner expressly authorizes publication of public MIT repo and binaries.

A green CI test on an internal runner is **not** a public release authorization.

For AC04, preserve exact-source contract-13 receipts for the two damaged-copy entrypoint launches on both target hosts. Record any OS refusal or unobserved modal error as an open witness requirement, not a successful application rejection. Do not change trust enforcement to make an altered package execute.
