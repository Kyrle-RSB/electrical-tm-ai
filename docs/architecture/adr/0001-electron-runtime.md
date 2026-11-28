# ADR 0001: Electron for Fork B

- **Owner approval:** 2026-11-23, D01 and subsequent repository approval.
- **Context:** public educational build of a single-user local invoicing app; no remote staff submissions.
- **Decision:** Electron with React + TypeScript renderer, sandboxed typed preload, main-process services, locally stored SQLite and optional provider adapters. No permanently listening HTTP service. macOS and Windows targets.
- **Why:** tangible desktop installation/OS integration, a largely TypeScript-based public source tree, opportunity to learn Electron with a real contractor workflow.
- **Alternatives considered:** Tauri (smaller binaries but Rust/toolchain complexity), Node/browser (good web model but server lifecycle/install friction), full Preonera (separate Fork A).
- **Evidence:** owner decision, official vendor docs, pinned CI, and actual isolated packaged Electron execution on macOS arm64 and Windows x64. The 66-test candidate c5f9936 passed both native workflows; subsequent revisions require exact-source re-verification. Synthetic same-user OS credential proofs do not replace independent denied-backend/different-account testing.
- **Open gates:** Exact final-source native receipts, independent OS credential review, clean-host novice installations, signing/distribution and independent security/release review.
- **Reversal trigger:** evidenced inability to meet runtime/security/installer requirements, with owner approval for any architecture change.
