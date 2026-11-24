# macOS installation and development verification

**Status: internal, unsigned engineering proof only. No public release is available. Do not use for customer billing.**

## What you need

* An Apple Silicon Mac. Native automated proof exists for earlier Phase 2 candidates; independently verify the exact commit and unsigned artifact under test.
* macOS Terminal, internet to install packages, Node version pinned in `.nvmrc` (24.22.3), and a ZIP of this exact source revision.
* No Claude account, Gmail account, or real customer information is required.

## If you are testing the source as a developer

1. Download this source archive. Double-click it to extract it somewhere writable, such as Downloads.
2. Open Terminal using Spotlight. Type `node --version`. If Node isn't installed, use the official Node site and install the exact version in `.nvmrc` (24.22.3); then reopen Terminal.
3. In Finder open the extracted folder and drag the project folder onto Terminal after typing `cd `, then press Return. Run `ls package.json` and confirm the file exists.
4. Run `npx --yes pnpm@12.21.0 install --frozen-lockfile`. The workspace uses `nodeLinker: hoisted` in `pnpm-workspace.yaml`. Do not change global pnpm settings.
5. Run `npx --yes pnpm@12.21.0 test`. Every automated local test must pass.
6. Run `npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start`. Leave Terminal running. The Electron application should open, with a local project list and business profile.
7. Verify only synthetic records. Press **Check health** and confirm `{ "status": "ok", "foundation": true }`. Create a fictional project, quit Electron, restart, and confirm the record appears automatically.
8. Quit the app and stop Forge with Control+C. Run `npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop make --platform=darwin --arch=arm64`.
9. Inspect `apps/desktop/out/ElectricalTMCockpit-darwin-arm64/ElectricalTMCockpit.app`. Run `node scripts/run-packaged-smoke.mjs` **on the Mac**. The script must report PASS, including synthetic cockpit and three-process lifecycle checks, before checking the GUI. A developer build is not the independent novice install.
10. Quit development Electron completely. Open the packaged app separately, without Vite. Verify the local health check, fictional project persistence, safe PDF export, fake token, image import and backup/restore against the isolated test profile.

**Unsigned builds may trigger Gatekeeper warnings. Do not disable Gatekeeper or remove OS quarantine for unknown software.** Only use your own freshly built internal proof, and stop to investigate unrecognized warnings.

## For eventual nontechnical users

A signed/notarized installer and tested novice instructions will be distributed through a public GitHub release only after explicit authorization. **That release does not exist yet.** The source-build process above is for contributors, not an acceptable substitute for a customer installer.

See [troubleshooting](troubleshooting.md) and [backups](backups-restore.md). Save redacted build logs and the source ZIP SHA-256 with your test results.
