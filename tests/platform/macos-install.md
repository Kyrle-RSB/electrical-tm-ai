# Mac native verification for this construction snapshot

This source revision has not yet been run on macOS. Use synthetic data only.

1. Extract the ZIP into a **new** directory. Do not replace the older working test folder.
2. Install Node 24 or newer and run from `electrical-tm/`:

```bash
npx --yes pnpm@12.21.0 install --frozen-lockfile
npx --yes pnpm@12.21.0 proof:compile
npx --yes pnpm@12.21.0 proof:run
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start
```

3. Verify the app clearly identifies itself as **Phase 2 construction**, creates/list projects and archives/reopens a synthetic project. Record the result.
4. Build the unsigned internal Mac ARM64 package:

```bash
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop make --platform=darwin --arch=arm64
```

5. Stop Forge and all old construction app processes before launching the generated `.app` directly. Verify a separate `ElectricalTMCockpit-P2-Internal` data profile, startup, saved-project restart, health, logo-free synthetic PDF to new filename, Replace confirmation and refusal on Cancel, image import, fake credential probe and backup/restore. Do not test with any customer information.
6. Save exact logs/screenshots, OS build, generated SHA-256, errors and a reviewer identity. Mark any unexecuted test BLOCKED, never PASS.

**Important:** The Electron construction build is NOT a signed, notarized or certified product release.
