# Windows installation and source verification

**Status: unsigned internal engineering proof only; no customer release.** Earlier candidates have passed Windows native CI. Verify the exact candidate commit and artifact; CI does not substitute for an independent clean-machine witness.

## Internal developer validation

1. Use a real supported Windows x64 installation. Obtain the exact source ZIP and its SHA-256 fingerprint from the project owner.
2. Install the exact Node.js x64 version in `.nvmrc` (24.22.3) from the official Node.js site. Open PowerShell. Confirm `node --version` and `npm --version`.
3. Extract the ZIP with File Explorer to a writable folder. In PowerShell, change to the extracted `electrical-tm` folder containing `package.json`.
4. Run `npx --yes pnpm@12.21.0 install --frozen-lockfile`. The workspace requires the `nodeLinker: hoisted` entry in `pnpm-workspace.yaml`.
5. Run `npx --yes pnpm@12.21.0 test`. Stop if any test fails. Do not report a Mac test as a Windows pass.
6. Run `npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start`. Verify Electron opens, displays its React UI, and can persist fictional records across restart.
7. Quit Electron and Forge. Build with `npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop make --platform=win32 --arch=x64`.
8. Run `node scripts/run-packaged-smoke.mjs` on Windows. The executable must launch without Vite and produce verified synthetic cockpit and three-process lifecycle receipts.
9. Check file import, synthetic PDF output and user-confirmed Replace behavior, SQLite persistence, OS-protected fake credential storage/revocation, backup and verified restore, shutdown, repeat launch, and uninstall without touching user data.
10. Record Windows edition/build, OS architecture, Node/pnpm/Electron versions, source SHA, packaged artifact SHA, observed result, and any SmartScreen prompts.

## Publisher warnings and limitations

This build is unsigned. SmartScreen can warn even when a software publisher begins signing; release-grade trust requires a separate signing/verification process and reputation. Do not disable SmartScreen or persuade users to bypass security. No public Windows installer is authorized yet. Never test using live contractor receipts, invoices, provider keys, or user home directories.
