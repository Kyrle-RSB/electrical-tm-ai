# Main/preload/renderer IPC contracts

The renderer has no direct Node, file-system, database or secret access. It invokes only explicitly declared preload bridge methods. All methods use version 1 envelopes with a UUIDv4 request ID, payload size limit, strict input validator and a live same-frame sender check in Electron main. Responses carry a typed success result or a sanitized error with a correlation ID. Duplicate request IDs are rejected for the lifetime of the process. Successful database mutations additionally store the normalized request ID in the same SQLite transaction as their changes and audit records. Reuse of that ID is denied across process restarts and across database mutation channels. The receipt tracks database history, not discarded history after restoring an older backup. OS dialogs, file exports and other non-database effects still use the session guard. Both success and failure envelopes must correlate to the exact requested ID.

Current Phase 2 increments:
- `business.get`, `business.update`: single local company profile, nonsecret configuration only.
- `projects.listDetailed`, `projects.updateDetails`, `projects.setStatus`: project status/detail writes with audit records.
- Existing read/add/health/import/PDF/backup/fake-secret proof channels remain.

The packaged proof enumerates every fixed bridge method from a distinct native WebContents, verifies nine malformed main-frame requests, compares a synthetic logical data and managed-file census, and records effective isolation and CSP/permission results. Error messages for known input-only validation failures are mapped to VALIDATION without reclassifying unsafe filesystem failures. Permission queries and permission requests are denied by the main-process session. Raw transport/replay and injected frame identity remain covered by separate foundation tests; the renderer is never given a raw IPC method.

**Not yet complete:** exact-source native proof of this increment, independent security and real development HMR verification, durable idempotency for future financial and non-database operations, future AI/Gmail handlers and independent security reviewer sign-off. The local single-operator model remains unchanged.

The single outer main-process registrar rejects non-allowlisted channel registration, requires exactly one raw argument after sender verification, validates the versioned envelope and claims its request ID before dispatch. Denial diagnostics are best effort and cannot replace the sanitized rejection with a filesystem exception. The inner handlers retain their own guards. Unknown unregistered channels are rejected by Electron, not routed to an arbitrary application handler. No raw transport is exposed to the production renderer.
