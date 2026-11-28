# ADR-0010: Source lint gate with ESLint

**Status:** accepted, 2026-11-28. Recorded after the fact for the Phase 2 integrity PR (#2), which added the dependencies.

**Context:** `CONTRIBUTING.md` requires an ADR for every new dependency. Phase 2 made `pnpm quality:source` run a lint step before the secret, licence and requirements audits, and the approved path catalog already lists `eslint.config.mjs`. The TypeScript compiler catches type errors but not unreachable code, a left-in `debugger`, duplicate object keys or an unsafe `finally`.

**Chosen:** two development-only dependencies, pinned exactly:
* `eslint` 9.39.1 (MIT)
* `@typescript-eslint/parser` 8.48.1 (MIT), so ESLint can read `.ts` and `.tsx`.

The rule set in `eslint.config.mjs` is deliberately small: `no-debugger`, `no-unreachable`, `no-dupe-keys`, `no-sparse-arrays`, `no-irregular-whitespace` and `no-unsafe-finally`, all errors, with `--max-warnings=0`. Formatting is not linted. The strict TypeScript typechecks stay separate, required gates.

**Not chosen:** no lint (leaves those mistakes to review); the full `typescript-eslint` plugin and recommended presets (many more packages and rules for little gain at this size); Biome or another tool (a second toolchain beside TypeScript and ESLint).

**Consequences:** the dependencies ship in no build; they run only in `pnpm lint` and `pnpm quality:source`, locally and in CI. `scripts/verify-licenses.mjs` inventories both. `scripts/audit-requirements.mjs --toolchain-negative` proves the gate rejects a `debugger` statement. A new rule or plugin needs this ADR updated.
