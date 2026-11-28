# Fork B: Native Electron Foundation Verification (Mac, then Windows)

**Phase 2 internal development verification only. Not a customer release.** Use the exact current candidate and independently retain its source/tree and artifact identity. Prior launches are historical proof. A clean, independent install and verified signed release have **not** happened.

## First, retain the source and existing test data safely

- Extract the repaired ZIP into a **new directory**. Keep the previous working source folder as a rollback, do not overwrite it in place.
- Do not bring `node_modules`, `.vite`, `dist-probe`, application databases, local receipts or any real API keys into the source repo.
- The app's development database is stored in the macOS Application Support directory, independently of the source folder. Running a new copy with the same bundle identity can read that same fictional-data profile. Back it up before a restore test. **Never use real customer data or real keys in this engineering proof.**
- Do not run multiple copies at once. This proof intentionally exits when its only window closes, including on macOS.

## Native Mac arm64 verification: source and dev runtime

Record macOS version, Mac architecture, Node version, pnpm version, installed package versions, test date and whether each step is observed. Record logs/screenshots with personal paths redacted.

From the **fresh source repository root**:

```bash
node -v
npx --yes pnpm@12.21.0 --version
npx --yes pnpm@12.21.0 install --frozen-lockfile
npx --yes pnpm@12.21.0 proof:compile
npx --yes pnpm@12.21.0 proof:run
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop start
```

The run must pass the complete current foundation test suite (see the commit-linked CI receipt), then a real Electron window. **Keep the Forge Terminal process running** while you test in development.

Check that:

1. The interface displays styled, legible text and buttons in the OS's light and dark appearance (not black text on graphite).
2. The existing synthetic `SYN-001` project, if present from earlier tests, **loads automatically without clicking Refresh** after startup. Otherwise create a new unique synthetic project, quit the *Electron app*, restart, and observe it appear without a click.
3. Check Health yields `{"status":"ok","foundation":true}`. Create project / Refresh continue working, including after restart.
4. `Command + Option + I` -> DevTools Console. **No blocked Vite `style-src` or local websocket `connect-src` CSP errors**. The development allowance is restricted to local HMR and inline styles. It is never shipped in the packaged HTML.
5. Native dialog imports a synthetic receipt image. Generated PDF includes fictional tax ID and electrical contractor license ID. Choose backup folder and restore a **synthetic-only** backup. Run project-list and project-create again **after restore**, catching the stale-connection regression.
6. Fake-token storage/read still works with macOS safeStorage; fake-token ciphertext must not equal plaintext. Never enter a real secret. Check simulated denial/failure behavior separately.

**If any item fails, stop and record its full error and the exact test step.** The Linux/Node checks do not substitute for macOS Electron integration results.

## Native Mac packaging gate (repeat on the exact candidate revision)

After the development tests succeed, quit the Electron app and make an unsigned **internal testing package**:

```bash
npx --yes pnpm@12.21.0 --filter @electrical-tm/desktop make --platform=darwin --arch=arm64
```

Inspect `apps/desktop/out/` for generated artifacts. Record full artifact path, SHA-256, size, signing/notarization state, macOS security prompts and launch result. Launch the packaged `.app` **without running Forge or port 5173**. Confirm that the `tmapp://` scheme serves the HTML/CSS/JS, the bundled migration is found, and the project + backup workflow works. A successful unsigned test ZIP does **not** prove novice installation or public release suitability. Do not bypass macOS protection or publish installers to solve development-only issues.

## Windows x64 gate

Run equivalent tests on a real Windows x64 environment. Check Windows secure storage, installer trust, native file dialogs, data paths, rollback, CSS, and project survival after restart. A Mac result does not authorize a Windows claim. Record the exact build, OS, logs and independent tester review.

## Evidence requirements and unresolved acceptance gates

- Formal Phase 1 is **NO-GO** until every applicable item among the 195 requirements has evidence and required review, and owner authorization occurs.
- F01 native packaged Electron/macOS and Windows verification remains **open** until captured.
- F02 native protected credential storage, including failure modes, remains **partially observed**.
- F07 independent, uncoached install of actual release artifacts remains **blocked**.
- Security review, code-signing/notarization decisions, public-source secret scan, backup restore on packaged artifacts, and separate independent financial review remain open.
- The owner's confirmed direct DB inspection plus DevTools bridge output is evidence of persistence and retrieval for `SYN-001`, not an independent certified end-user acceptance result.


## Native execution bundle: current Phase 2 continuation (not a release certificate)

For a clean source checkout with the exact Node version in `.nvmrc` and the pinned pnpm version, run from the
repository root on **macOS arm64** or **Windows x64**:

```sh
node scripts/capture-native-proof.mjs --plan
node scripts/capture-native-proof.mjs --execute
```

The execution command installs dependencies, runs the local regression suite, typechecks
the desktop, performs source/security audits, builds the unsigned internal package,
and launches the real packaged Electron binary **with Vite stopped**. The app's native
smoke must verify: isolated profile; actual renderer/IPC; SQLite project persistence;
new and confirmed-replacement synthetic PDFs; image-vault import and hash; real
OS protected-secret round trip and revocation; complete backup/restore including
attachments. The test writes an evidence file, because Windows GUI executables may
not forward console output to the launch process.

Inspect `.local-evidence/native-*.tar.gz` for unexpected private details before
sharing it. Running this bundle is not equivalent to finishing P2-AC01..AC30 or
a novice installation, independent security review, or user acceptance. A failed native check must be investigated and repaired where it is an executable source or harness defect; an actual unavailable host observation remains an open witness with its failed result retained.

The previous Phase 1 evidence belongs to older revisions and is not substituted
for this exact source version.

### November 24 continuation
The earlier commit `761ecde1e7991c8a4afcefb50ae9bdead4a38722` passed Mac/Windows packaged automation. It is not evidence for later changed source. Run `node scripts/capture-native-proof.mjs --execute` on the exact candidate revision and inspect its result; the added native checks cover foreign-window IPC rejection, strict packaged CSP/inline-script rejection, SQLite reopen and automatic UI load, protected-secret re-read/revocation and backup tampering. The v3 evidence collector requires a three-process seed/reopen/revoke lifecycle; v4 additionally checks synthetic cockpit form interactions and zoom layouts. Physical OS denial and clean independent install remain separate witnessed requirements.

### Damaged package observation

The complete native collector requires actual launch of isolated disposable copies with the named main, preload and root renderer entries misnamed, and verifies restoration of the original ASAR bytes. Intact package smoke is separate. The missing-main path starts before application logging; observe a named Electron loader error and natural exit 1 without bypassing trust or using a forced process kill as evidence. A normal OS refusal, timeout or inaccessible modal is not a pass. The missing-preload and missing-root checks require named application diagnostics, exit 1, shutdown and unchanged synthetic records. Preserve all failure receipts. Human observers must use only a normally trusted controlled host and the approved synthetic fixture, record actual exit behavior and return privately redacted evidence bound to the exact source and artifact.
