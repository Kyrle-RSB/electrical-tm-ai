# Fork B | Phase 1 foundation source repair and verification addendum

**Scope:** Repair source uploaded from the owner's successful November 23 macOS Electron development launch. **Verdict: Phase 1 NO-GO.** This is a source-code repair and bounded feasibility addendum, not a release, not an independent audit, and not Phase 2 authorization.

## Confirmed before repair (from owner's on-Mac outputs and screenshots)

- On a Mac using Node 26.13.0 and pnpm 12.21.0, dependencies installed, `proof:compile` completed, **11/11 prior foundation tests passed**.
- Electron Forge 8 launched a native desktop window after correcting main/preload bundle names to `.vite/build/main.cjs` and `.vite/build/preload.cjs`.
- React rendered after placing `index.html` at the Vite project root; an earlier Vite request at `/` returned 404.
- Health IPC returned `{"status":"ok","foundation":true}`; fake credential test reported stored/read success.
- Project `SYN-001` was present in SQLite after quitting/restarting the application. The owner queried the database directly and successfully retrieved it via `window.tmBridge.listProjects()`; a later screenshot showed the React list after Refresh. **This establishes persistence**, while revealing that automatic loading was missing.
- DevTools reported `style-src` and `connect-src` CSP errors, consistent with dark-background/unstyled-text rendering.

**Limits of owner observations:** No complete original machine logs or package installation receipts are bundled. App keychain protection, packaged runtime, Windows compatibility, independent assessment, installation, all financial cases and exact phase-gate closure are not proven.

## Repair changes applied to the uploaded source

1. `apps/desktop/vite.renderer.config.ts`: development-server HTML-only CSP transformer permits local Vite websocket connections and Vite-injected inline CSS. The source `index.html` stays strict for production. No remote connections or `unsafe-eval` added.
2. `apps/desktop/index.html`: strict packaged renderer CSP adds explicit no-objects/no-frames directives.
3. `apps/desktop/src/renderer/App.tsx`: retrieve existing synthetic projects on first mount and expose loading/empty/error states; manual Refresh retained.
4. `apps/desktop/src/renderer/theme/tokens.css`: readable saved-record status and list presentation; preserve OS appearance and reduced-motion preference.
5. `apps/desktop/src/main/ipc/register.ts` and `apps/desktop/src/main/index.ts`: get the **current** `LocalStore` for every project operation, so restoring a backup cannot leave IPC bound to a closed store. The single-window engineering proof quits on last window close on macOS too, to prevent orphaned development instances.
6. `tests/foundation/foundation.test.ts`: add regression for store replacement, strict/development CSP checks, and a test actually executing the Vite HTML transformer.
7. `.npmrc`: remove stale `node-linker` setting; pnpm 12 uses `nodeLinker: hoisted` in existing `pnpm-workspace.yaml`.
8. Remove Finder artifacts, obsolete patch backup files, and the duplicate unused `src/renderer/index.html` from the public source candidate. The current working Vite root uses `apps/desktop/index.html`.

## Verification conducted here

- **14/14 Node foundation tests passed on Linux Node 22.16.0** (including the 11 inherited tests, backup-rebinding regression and both CSP checks).
- TypeScript probe project compiled without errors using the environment's globally installed TypeScript 5.8.3 and temporary Node type declarations; the user's pnpm project remains pinned to TypeScript 5.9.3.
- Vite HTML CSP transform was executed with a defined Vite-config stub: dev policy adds only localhost HMR connectivity and inline styles; production HTML remains strict; unknown policy fails closed.
- **20 TS/TSX source files** transpiled with no syntax diagnostic. This is **not** a full Electron/React typecheck or GUI test.
- Zip checksum verification is generated at package time. No real tokens, email sending or customer financial records were used.

## Remaining verification and governance issues

- Repaired-source **macOS GUI** run (styled layout, automatic project load, actual DevTools CSP behavior) has not yet occurred.
- macOS arm64 **packaged .app** startup and no-dev-server renderer + SQLite migration/resources are untested; ditto native Windows x64.
- Native protected storage and backup restore on packaged artifacts, no-leak/no-fallback security checks, clean novice install, independent reviews, signing/notarization and release decisions remain incomplete.
- **Approved 239-path file catalogue:** the working Vite root contains a necessary `apps/desktop/index.html` path outside the earlier planned file map, replacing the old planned `src/renderer/index.html`. This observed technical correction is documented as a *specific path exception pending formal owner ratification*, not an unapproved overhaul of the architecture. The architecture itself (Electron, SQLite, React, IPC, local storage) remains intact.
- The authoritative Phase 1 baseline retains **195 mandatory checklist entries** and formal NO-GO. This addendum does not invent item-level independent PASS approvals or imply the start of Phase 2.
