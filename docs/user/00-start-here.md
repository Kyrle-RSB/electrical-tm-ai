# Start here: Electrical T&M construction build

The application is being developed in public for electrical contractors. **This is still a synthetic-data construction build, not approved for real invoices or customer information.**

A developer can launch with the Node version pinned in `.nvmrc`, pnpm 12.21.0, and Electron Forge. See the root `README.md` and `docs/user/install-macos.md` or `docs/user/install-windows.md`. No Claude or Gmail credentials are required for the manual foundation.

The application stores test data locally under a separate Phase 2 internal profile and does not depend on a hosted server. Avoid putting actual receipts or API credentials in test data. Future release guides will cover installer signing, actual user setup, Claude API and Google OAuth in complete step-by-step detail.

## Current Phase 2 construction snapshot

This is a **development-only Electron foundation**, not an approved invoicing system. Its real UI now supports creating, editing and archiving synthetic projects, editing a local business identity, importing synthetic photos, setting a backup folder, making a verified backup, restoring synthetic data and generating a synthetic PDF. It implements rate/money/overhead calculations only as future billing foundations. Claude and Gmail are **not** configured or active in this phase; never enter real API credentials in the fake-token test.

The app opens on **Today**. The sidebar lists Today, Jobs, Customers, Crew, Materials, Invoices, Reports and Settings; below about 1200 px wide it shrinks to icons, and the button at the left of the header expands or collapses it. Projects are under **Jobs**; the business profile, appearance, backup and restore, and the foundation tools are under **Settings**. Screens that are not built yet say what is coming. Press **Cmd+K** on a Mac or **Ctrl+K** on Windows, or type in the header search, to jump to any screen, find a saved project or run an action; use the arrow keys and Enter, and Escape to close.

To test the revised code, install the pinned dependencies and follow `docs/user/install-macos.md` or `install-windows.md` and the platform evidence checklist. Earlier native proof belongs to its exact source and artifacts. Use the current candidate collector, not an earlier successful result, for certification.
