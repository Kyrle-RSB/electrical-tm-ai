# Local projects and business setup (construction preview)

This build is **not ready for actual client information**. Open the standalone Electron window using the source development commands in the root README. The app uses an isolated internal test profile.

- Enter a unique synthetic project code and fictional customer/site address. Click **Create fictional project**.
- Saved projects load automatically after app restart. Click **Refresh** to verify.
- Each project has an Archive/Reopen button, preserving audit history rather than deleting historical records.
- The Business profile form stores a fictional company identity, contact address, tax ID and contractor-license ID in the local SQLite database. Do not input genuine credentials into the proof app.
- Labor rates and timesheet workflows are future steps; the initial schema holds rate-version structures only.

**Troubleshooting:** If the project created in the old Phase 1 proof is not shown in this construction build, that is intentional: Phase 2 uses a separate local data directory to avoid changing existing records.
