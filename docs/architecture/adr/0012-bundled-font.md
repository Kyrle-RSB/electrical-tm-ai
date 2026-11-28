# ADR-0012: Bundle Inter as the one interface font

**Status:** accepted, 2026-11-28 (Phase 2, item "Design system").

**Context:** the app runs offline under a CSP that allows fonts only from the app itself (`font-src 'self'`), so Google Fonts or any CDN is impossible. System fonts differ between macOS and Windows, which makes the same screen look different on each and gives inconsistent number widths in timesheets and invoices.

**Chosen:** Inter 4.1, the single variable roman file, vendored into the repository (not an npm package):
* File: `apps/desktop/src/renderer/theme/fonts/InterVariable.woff2`, 352,240 bytes, SHA-256 `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`, taken unchanged from `web/InterVariable.woff2` in the official release `Inter-4.1.zip` (github.com/rsms/inter, tag v4.1; zip SHA-256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`).
* Licence: SIL Open Font License 1.1, copyright The Inter Project Authors. The full text ships beside the font as `OFL.txt`. OFL allows bundling and redistribution inside software, including commercial software, as long as the font is not sold on its own and the licence travels with it. Inter declares no Reserved Font Name.
* Loaded once by `@font-face` in `tokens.css` (weights 100 to 900 from one file, `font-display: block` because the file is local). Vite emits it as a build asset; the packaged `tmapp://` handler serves it.
* Why Inter: designed for screens and dense interfaces, a variable weight axis and optical sizes in one file, wide Latin coverage (English and French Canadian), and true tabular figures (`font-variant-numeric: tabular-nums`), which every number column, money field and figure uses.
* Monospace (paths, token names) uses the system's `ui-monospace` stack; it needs no bundled file.

**Not chosen:** system fonts only (inconsistent across platforms, uneven tabular figures); IBM Plex Sans or Geist (good, but Plex ships as several static files and Geist has a shorter record in dense data UIs); the `@fontsource-variable/inter` npm package (a new dependency and subset files for no gain over one checked file); the italic file (not used; it can be added under this ADR).

**Consequences:** about 344 KB added to the app and repository. `tests/unit/design-tokens.test.ts` checks the file is a WOFF2, that `OFL.txt` is present, and that no stylesheet loads anything remote. A font update replaces the file and updates the hash and version here.
