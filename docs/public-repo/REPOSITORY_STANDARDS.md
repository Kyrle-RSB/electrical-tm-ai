# Repository standards (Fork B)

MIT source intended for public publication, **but not currently released**. Owner must authorize publication.

* One canonical worktree, a reviewable branch per bounded change. No direct unreviewed production commits.
* Pull requests must include tests, failed-case receipts, backups/migration impacts and user help updates.
* No real invoices, receipts, API keys, Gmail OAuth secrets, databases, access tokens or credentials in the repository.
* Production renderer cannot import Node, Electron or data adapters; only typed preload methods.
* Preserve append-only SQLite migration checksums. Add new migration, never edit one installed by users.
* Developers may verify source tests on Linux, but only native Mac/Windows tests certify those targets.
* CI builds are unsigned *internal proof artifacts*, not trusted public installers. Signing, notarization,
  novice installations and independent audit must pass separately before public release.
* The exact Vite root `apps/desktop/index.html` is an evidenced working exception to the approved
  architecture catalog; owner ratification remains an open ADR until explicitly approved.
