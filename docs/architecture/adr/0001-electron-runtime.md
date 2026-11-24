# ADR 0001: Electron for Fork B

- **Owner approval:** 2026-11-23, D01 and subsequent repository approval.
- **Context:** public educational build of a single-user local invoicing app; no remote staff submissions.
- **Decision:** Electron with React + TypeScript renderer, sandboxed typed preload, main-process services, locally stored SQLite and optional provider adapters. No permanently listening HTTP service. macOS and Windows targets.
- **Why:** tangible desktop installation/OS integration, a largely TypeScript-based public source tree, opportunity to learn Electron with a real contractor workflow.
- **Alternatives considered:** Tauri (smaller binaries but Rust/toolchain complexity), Node/browser (good web model but server lifecycle/install friction), full Preonera (separate Fork A).
- **Evidence:** owner decision and official vendor docs, plus narrow Linux TypeScript/SQLite proof; **no Electron runtime, package, secure vault or supported OS confirmation yet**.
- **Open gates:** F01 packaged on macOS/Windows, F02 real keychain, F07 novice installations, dependency signing/lockfile, independent security review.
- **Reversal trigger:** evidenced inability to meet runtime/security/installer requirements, with owner approval for any architecture change.
