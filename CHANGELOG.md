# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Plugin blocks now work for CJS consumers.** The block registry lived in module scope, and the CJS build embeds a copy of it in each entry point, so a type registered via `registerBlockType` (from `kapom-report/advanced`) was invisible to `createKapomReport` (from the main entry) and every plugin block threw `Block type '…' is not registered` under `require()`. The registry is now shared across every copy in the process, which also covers a consumer who ends up with two copies of the package installed, or who mixes the ESM and CJS builds. ESM was never affected.
- **A bad numeric value no longer prints as `NaN`.** `Decimalish` accepts strings (mysql2/pg return `DECIMAL` columns as strings), and the boundary only checked the type — so `'N/A'`, `'-'` or a pre-formatted `'1,234.00'` reached the page as a literal `NaN` inside a total, and `''` silently counted as a real `0`. Every value entering arithmetic or number formatting is now validated, including the `computed` / `runningTotal` paths that previously bypassed the check entirely.
- A custom `aggregate` function returning a non-numeric string (`() => 'n/a'`) used to render as `NaN`; it is now printed verbatim, as the deliberate placeholder it reads as.
- **Column `width`s that don't fit no longer overflow the page silently.** Only auto-width columns are ever scaled, so once the fixed widths alone filled the content area the table was simply drawn past the right margin, with no error from this library or from AutoTable.
- **`nested(row)` runs once per row instead of twice.** Measure and render both walked every master row, and each level built a throwaway child table for measuring and another for rendering — so a resolver's cost doubled again at every level down the tree.
- A `nested` resolver that never bottoms out used to fail as a bare `Maximum call stack size exceeded` from deep inside measure; it now throws a `KapomError` naming the cause once nesting passes 10 levels.
- Two stale error messages: the Thai font guard pointed at `summaryLabel`/`footerLabel` defaults that became English in 0.1.x, and an unregistered block type pointed at a file that isn't published. The latter now lists the types that *are* registered.
- **Float noise no longer shows up as an off-by-one-cent.** `3 × 1.115` is 3.3449999999999998 in binary floating point, so an amount column printed `3.34` where every hand calculation and spreadsheet says `3.35`. Values are now snapped a few decimal places past what's displayed before formatting, which removes the artifact without touching any digit you asked to see (and without touching stored values or anything a `NumericStrategy` computed). Exact decimal arithmetic remains available by supplying your own `numeric` strategy.
- Theme colours are validated and copied. An out-of-range or non-numeric channel was silently clamped by jsPDF (a wrong-coloured report you only notice in print), and a resolved theme held onto the caller's array, so mutating it later changed the report's colours mid-flight.

### Changed

- A value that cannot be parsed as a finite number now throws a `KapomError` naming the column and row instead of rendering. If your data legitimately contains blanks or placeholders in a numeric column, map them before passing the data in (`price: row.price ?? 0`), or use a `formatter` on that column to control the display yourself. `aggregate: 'count'` is unaffected — it never reads the values, so counting a text column still works.
- Fixed column widths that exceed the content area now throw a `KapomLayoutError` reporting the totals. Widths that exactly fill it are still fine when *every* column is fixed, and an error when an auto-width column is left with no room.
- `GroupResolver.keepTogether` is the exported `KeepTogetherPolicy` interface rather than an inline anonymous type, so callers can name it. Structurally identical — no change to how it's written.

### Added

- `hasBlockType(type)` and `isFiniteDecimalish(value)`, exported from `kapom-report/advanced` — check a block-type name before registering it (instead of catching the duplicate-name throw), and test a value against the numeric boundary without throwing.
- `kapom-report/advanced` now exports the composite block classes (`BoxBlock`, `RowBlock`, `KeyValueBlock`, `BottomAnchorBlock`) with their constructor option types, plus what authoring a composite block actually requires: `deriveMeasureContext`, `measureBlocksHeight`, `buildConfinedContext`, `applyTextStyle`, `lineHeightOf`, `splitTextLines`, `measureTextBlockHeight`, and `assertFixedWidthsFit`.

## [0.1.2] - 2026-07-21

Metadata and documentation only — no code changes, nothing to migrate.

### Changed

- npm keywords reworked for discoverability (`report-generator`, `report-builder`, `server-side`, `serverless`, `backend`, `nodejs`).
- `homepage` now points at the published API reference rather than the repo.

### Docs

- README examples use the `col.data()` column constructors.
- The Thai-font README example is English-only, so it renders without a Thai font registered.

## [0.1.1] - 2026-07-19

### Fixed

- `.summary()` / `bottomAnchor` — a summary pinned to the page bottom (a signature, a report footer) no longer breaks onto a spurious extra page at the exact bottom edge (a floating-point rounding). It now pins reliably to the bottom of its page, including when it lands on a fresh page after a page break.

### Docs

- README examples now lead with the `reportBuilder()` fluent API (the object-form `createKapomReport` is noted as the alternative).
- Published a TypeDoc API reference: https://vimpys.github.io/kapom-report/

## [0.1.0] - 2026-07-19

### Added

- **Declarative report tree** — `ReportNode` as single source of truth; fluent chain optional wrapper
- **Core blocks**: text, spacer, divider, image, table (flat + grouped + nested master-detail)
- **Composite layouts**: stack, section, row (side-by-side columns with fixed/flexible widths, keep-together), keyValue (aligned label:value rows), box (painted background/border container that splits across pages clone-style), bottomAnchor (pins children to the page bottom — a signature / report footer), signature (multi-slot), raw escape hatch for custom drawing
- **Text alignment**: `align: 'left' | 'center' | 'right'` on text blocks (per line, after wrapping)
- **Node shorthand constructors**: `spacer(4)` / `spacer()` and `divider({ ... })` / `divider()` in place of the full node objects; both zero-config (a spacer omitting `height` uses a default gap, a divider a default line)
- **`pageBreak()` block**: forces the flow onto a new page (a standalone counterpart to a section's `breakBefore`); no-op when already at the top of a page
- **`col<T>()` column constructors** (Zod-style): `const c = col<Row>()` then `c.data(key, header, extra?)` / `c.computed(header, compute, extra?)` / `c.runningTotal(header, valueOf, extra?)` / `c.rowNumber(extra?)` / `c.group(header, columns, extra?)` — a shorter alternative to column object literals; composes with `.map()` for grouped headers. Object literals still work everywhere.
- **Table features**: 
  - Data columns are the default kind — `type: 'data'` may be omitted (write `{ key, header }`); only non-data columns (`rowNumber`/`computed`/`runningTotal`/`group`) need an explicit `type`
  - Row numbers (continuous/per-group/per-page)
  - Computed columns, running totals
  - Aggregates (sum/avg/count/min/max/custom function)
  - Nested group (N-level recursive, band + subtotals + keep-together per level)
  - Nested table (master-detail; row can expand to show child table with different columns) — `nestedLayout: 'stacked'` (default) keeps the master header + that row's identity with the detail when a long child breaks across pages; `'below'` indents the child under its row instead (only the child's own header repeats on a break)
  - Zebra striping, conditional row styles, column-level style overrides, table-level header style override (brand fill/text color); header cells default to centered (horizontal + vertical)
  - Column groups (`type: 'group'`) — a spanning super-header over several columns; nests to any depth (groups within groups) for multi-level headers, spans (colSpan/rowSpan) derived automatically
  - No-data fallback message
- **Page composition**: repeating page header/footer bands (raw render callback or a declarative block tree), page-number annotation (margin-only, non-reserved), system field placeholders (`{pageNumber}`, `{totalPages}`, `{date}`, `{time}`, `{dateTime}`), watermarks
- **Multi-section reports**: `ReportRegistry` to compose sections by name with shared context, `breakBefore` policy for section page breaks
- **Typography system**: 9 semantic tokens (reportTitle, reportSubtitle, sectionHeading, columnHeader, detailRow, groupHeader, groupFooter, summary, pageHeaderFooter)
- **Font registration**: non-standard script support (e.g., Thai) with fail-fast Thai-font guard; base64/Uint8Array input
- **Text normalization**: tab→spaces, CRLF→LF, zero-width/bidi/control strip, NBSP→space
- **Two ways to build a report**: `createKapomReport({ ... })` (object config) and `reportBuilder()` (fluent builder — section names follow the report anatomy; page header/footer are `BandBuilder` sub-builders with `.addBlock()` and auto-measured height; `title`/`content`/`summary`/`pageNumber`/`pageSetup`/… are chainable methods); both emit the same tree
- **Auto-measured band height**: a declarative page header/footer with no explicit `height` is measured from its blocks by the engine (no magic number)
- **Progressive disclosure**: zero-config sensible defaults → shorthand syntax → full declarative tree (pattern applied consistently across all config)
- **Strict TypeScript**: no `any`, `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` enforced
- **Block registry pattern**: extensible type system; built-in blocks self-register (Open/Closed Principle)
- **Universal delivery**: Node + browser (bundler-friendly; Node I/O isolated to `node-io.ts`, no static `node:` imports in core)
- **Cursor engine**: pure x/y tracking + page-break logic; `PdfCursor` separate from jsPDF
- **Numeric strategy**: arithmetic boundary; supports Decimalish (number|string) with `NumericStrategy` contract
- **Number formatting**: Intl.NumberFormat with locale (default th-TH, 2 decimals) + column-level override
- **Date formatting**: Intl.DateTimeFormat with Buddhist calendar opt-in (default en-CA)
- **18 runnable examples** covering: facade zero-config, text/image blocks, save/preview, flat table, styled table, grouped table, nested group, nested table (master-detail), report header/section, composite multi-section report, page header/footer, page number, system fields + anchor, signature + watermark, raw escape hatch, quotation (real-world branded document composed from row/keyValue/align), field service report (a data-filled form composed from box/row/divider — split into data / template / runner), modular report (a multi-page paginated sales report with a repeating logo/metadata header and page numbers, split into raw data / reusable template / runner)

### Technical

- ESM + CJS + .d.ts distribution via tsup
- peerDependencies: jsPDF 4.x, jspdf-autotable 5.x (not bundled)
- Node.js >=22.3 (for `process.getBuiltinModule` in Node I/O)
- jspdf-autotable module augmentation (lastAutoTable type) via side-effect import in index.ts
- Apache 2.0 / MIT dual-licensed

### Project Structure

- `src/core/` — cursor, engine, context, page-band, watermark, system-field, anchor, page-number, errors, text metrics/normalizer/draw
- `src/blocks/` — text, spacer, divider, image, table, signature, stack, section, row, keyValue, raw, block registry
- `src/table/` — column resolver, group resolver, group tree (recursive), column width computation, aggregates
- `src/format/` — number format, date format
- `src/font/` — font config, register fonts
- `src/report/` — report registry, report config resolver, node-io, createKapomReport facade
- `src/types/` — primitives, column, node, typography, jspdf-autotable augmentation
- `src/style/` — resolve cell style
- `examples/` — 15 demos (01-facade through 15-raw-escape-hatch, ordered basic→advanced)
- `tests/` — 374 tests, 45 test files (vitest)

### Notes

- All error messages in English (2026-07-07 decision, reversed Thai-default for zero-config UX)
- All code comments and examples in English
- "Page number" is a distinct concept from "page footer" — reserved-height band vs. margin-only annotation
- Master-detail (nested table) v1 scope: single-level nesting, no expand/collapse, no keep-together between master row and child
- "Nested group" (recursive GroupResolver.subGroup) is separate from "nested table" (TableNode.nested callback)
