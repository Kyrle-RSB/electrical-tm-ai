# Troubleshooting the electrical T&M development build

**Never delete a database or disable operating-system security merely to solve a startup problem.**

| Symptom | First safe check | Corrective direction |
|---|---|---|
| `No package.json found` | Run `pwd`/`ls package.json` | Change to repository root; do not run installs from your home directory |
| pnpm reports `ENOEXEC` | `npx --yes pnpm@12.21.0 --version` | Use pinned npx launcher; do not remove global files blindly |
| Forge says `node-linker must be hoisted` | Read `pnpm-workspace.yaml` | It must contain `nodeLinker: hoisted`; reinstall frozen lockfile after fixing |
| Electron exits 0 instantly | Check for an already running app instance | Do not kill unrelated Electron apps; close only the matching Fork B process |
| Window is blank | With Forge running, use `curl -I http://localhost:5173/` | 404 means dev HTML entry/routing; no server means Forge stopped; errors in DevTools mean JS/CSP |
| `main.cjs` missing | Verify Forge's named `main`/`preload` Vite entries | Preserve explicit names in `forge.config.ts` |
| CSP warning or styles missing | Compare Vite development transform to strict packaged CSP | Never globally disable CSP to fix styling |
| Project disappears after restart | Click Refresh, verify persisted SQLite with an authorized test | New UI auto-loads; never assume empty initial UI means data loss |
| Save PDF says `EEXIST` | Check whether a file already exists | Keep original or explicitly authorize synthetic Replace; issued invoice evidence is immutable |
| Backup restore fails | Inspect hash and SQLite-integrity warnings | Do not delete existing or rescue data; verify source backup and repeat with synthetic data |
| OS-protected token unavailable | Verify secure storage is actually available | Stop: no plaintext fallback is permitted |

Local startup events are saved as **redacted stage IDs only** in the current internal test profile's `diagnostics/startup.jsonl`. Do not publish logs containing file paths or client data. Exact current profile paths may differ across machines. The app may show system security prompts; read and understand them before authorizing access.

For synthetic lifecycle proof runs, the runner-created POSIX temp directory must belong to the current user and grant no group/other access. Do not relax its permissions; create a fresh runner-owned test profile instead. A detected redirected PDF destination or changed staged export is a refusal, not authorization to overwrite the original. Preserve any staged recovery file until the destination and previous export have been checked.

If a backup changes after verification, select and verify it again rather than bypassing confirmation. A detected unsafe PDF cleanup retains the staged file and preserves the original failure; inspect both before removing any retained temporary export.
