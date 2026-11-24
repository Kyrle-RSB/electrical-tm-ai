# Main/preload/renderer IPC contracts

The renderer has no direct Node, file-system, database or secret access. It invokes only explicitly declared preload bridge methods. All methods use a request ID, payload size limit, strict input validator and a live same-frame sender check in Electron main.

Current Phase 2 increments:
- `business.get`, `business.update`: single local company profile, nonsecret configuration only.
- `projects.listDetailed`, `projects.updateDetails`, `projects.setStatus`: project status/detail writes with audit records.
- Existing read/add/health/import/PDF/backup/fake-secret proof channels remain.

**Not yet complete:** typed error envelopes across all legacy handlers, idempotency keys for business writes, app role distinctions, future AI/Gmail handlers and security reviewer sign-off.
