# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-07

### Added

- **Declarative report tree** — `ReportNode` as single source of truth; fluent chain optional wrapper
- **Core blocks**: text, spacer, divider, image, table (flat + grouped + nested master-detail)
- **Composite layouts**: stack, section, row (side-by-side columns with fixed/flexible widths, keep-together), keyValue (aligned label:value rows), box (painted background/border container that splits across pages clone-style), bottomAnchor (pins children to the page bottom — a signature / report footer), signature (multi-slot), raw escape hatch for custom drawing
- **Text alignment**: `align: 'left' | 'center' | 'right'` on text blocks (per line, after wrapping)
- **Node shorthand constructors**: `spacer(4)` / `spacer()` and `divider({ ... })` / `divider()` in place of the full node objects; both zero-config (a spacer omitting `height` uses a default gap, a divider a default line)
- **`pageBreak()` block**: forces the flow onto a new page (a standalone counterpart to a section's `breakBefore`); no-op when already at the top of a page
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
