# kapom-report

Declarative PDF report library wrapping [jsPDF](https://github.com/parallax/jsPDF) 4.x + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) 5.x — auto grouping, subtotals, composite reports, strict TypeScript.

Solves the usual pain points of hand-rolled jsPDF reports: manual x/y cursor tracking, page-break bookkeeping, and re-deriving the same table/group/subtotal logic on every report. Multi-page (100+ pages) reports are a first-class case, not an afterthought.

## Install

```bash
npm install kapom-report jspdf jspdf-autotable
```

`jspdf`/`jspdf-autotable` are peer dependencies — kapom-report doesn't bundle them. Node.js >=22.3 (for the Node-side file I/O in `save()`/`preview()`); the core library also runs in the browser via a bundler.

## Quick start

```ts
import { createKapomReport } from 'kapom-report';

const report = createKapomReport({
  title: 'Monthly Sales Report',
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: [
    { product: 'Widget', qty: 12 },
    { product: 'Gadget', qty: 7 },
  ],
});

report.save('report.pdf');
```

No font setup, no jsPDF/AutoTable knowledge required — this renders a titled table with a summed "Total" row out of the box.

New to the layout? **[Report anatomy](examples/00-report-anatomy/)** maps every region of a report to the `reportBuilder()` method that produces it.

### Grouping and subtotals

```ts
// sales: { product: string; category: string; qty: number }[]
const report = createKapomReport({
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
  group: 'category', // shorthand — or ['region', 'category'] for nested groups
});
```

Each group gets a header band and a subtotal row; the whole table gets a grand total. Groups can nest to any depth via `GroupResolver.subGroup`, and keep-together rules stop a group's header from ever being stranded alone at the bottom of a page.

### Thai (or any non-Latin) text

Standard PDF fonts (helvetica, times, etc.) have no Thai glyphs — kapom-report fails fast with a clear error instead of silently producing mojibake. Register a real font to render Thai (or any script the font supports):

```ts
import { readFileSync } from 'node:fs';
import { createKapomReport } from 'kapom-report';

const report = createKapomReport({
  font: {
    fonts: [{ family: 'Sarabun', data: new Uint8Array(readFileSync('Sarabun-Regular.ttf')), style: 'normal' }],
  },
  columns: [{ key: 'name', header: 'ชื่อ' }],
  data: [{ name: 'ทดสอบ' }],
});
```

## Design

The library follows **progressive disclosure** everywhere a config exists:

1. **Zero-config** — a sensible default that works without touching it (e.g. no `numberFormat` → 2 decimal places; no `font` → works fine for Latin scripts).
2. **Shorthand** — the common case in one line (`group: 'category'`, `{ key, header }` instead of a full column object, `title: '...'` instead of a manual text block).
3. **Full object** — every shorthand is sugar over a plain declarative tree (`ReportNode`); drop down to the full shape any time you need more control.

Everything ultimately compiles to the same `ReportNode` tree, which is the single source of truth the render engine walks — the fluent/shorthand API never diverges from what you could write by hand.

## What's included

- **Blocks**: text, spacer, divider, image, table (flat + grouped + nested groups), signature, stack/section (composite layout), a raw escape hatch for custom drawing
- **Table features**: row numbers, computed columns, running totals, aggregates (sum/avg/count/min/max/custom), per-group or grand-total subtotals, zebra striping, conditional row styles, column-level style overrides
- **Page composition**: repeating page header/footer bands, anchored system fields (`{pageNumber}`, `{totalPages}`, `{date}`, ...), watermarks, a `ReportRegistry` for composing multi-section reports
- **Universal**: the core renders in Node and the browser (bundler-friendly, no static `node:` imports outside the Node I/O boundary)
- **Strict TypeScript**: no `any`, `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` clean

See [`examples/`](examples) for 13 runnable demos (numbered basic → advanced) covering every feature above — run any of them directly with `npx tsx examples/<name>/index.ts`, or `npm run demo` to generate all of them at once into `examples/output/`.

## Scripts

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest run
npm run build      # tsup → dist/ (ESM + CJS + .d.ts)
npm run demo       # generate every example PDF into examples/output/
```

## License

MIT
