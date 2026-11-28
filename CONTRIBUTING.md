# Contributing

This is an evidence-gated Phase 2 construction repository (not a production release). Do not submit production invoice claims. Use fictional data; open a pull request for fixes accompanied by exact test output and threat/failure cases. Avoid additional dependencies or network services without a justified ADR. The approved 239-path ownership map is authoritative: additions and path changes require review, not a casual rename. No contributor credentials, secrets, customer invoices or actual Gmail tokens belong in issues or commits.

Run `pnpm quality:source` and `node scripts/audit-requirements.mjs --self-test --toolchain-negative --bootstrap` after a frozen install on the exact `.nvmrc` Node and pinned pnpm. The latter exercises isolated linker, lock, lint and type-error fixtures. Do not change historical migrations or bypass a failing gate. Review the installed dependency inventory and its license obligations before distribution.

Use the native collector on both target platforms for changes affecting packaging, lifecycle or OS behavior. Preserve actual red receipts, source/tree and artifact identity. Author-side testing does not substitute for independent review. Do not work around a failing test, OS trust or required approval.
