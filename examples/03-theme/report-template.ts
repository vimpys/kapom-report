/**
 * File 2 of 3 — the report template.
 * Demo — themes: a ready-made colour scheme that drives the *fills* of every table surface
 * (column header, group band, per-group subtotal, grand total, and zebra stripes) plus the text
 * colour that sits on each fill — from a single `theme` argument.
 *
 * A theme is report-wide (resolved once per report), so the honest way to compare themes is to
 * build the *same* report and swap only the `theme` value — which is exactly what index.ts does.
 *
 * Progressive disclosure (theme has all three layers):
 *   layer 1  omit `theme`      → the default blue header / grey band / no zebra (unchanged look)
 *   layer 2  theme: 'green'    → a preset name. 9 built in:
 *                                  strong (dark fill, white text auto): blue green graphite wine amber
 *                                  pastel (light fill, dark text auto):  rose lavender aqua stone
 *   layer 3  theme: { primary, bandFill, ... } → a full object; only primary + bandFill are
 *            required. onPrimary/onBand auto-pick black or white by luminance; zebraFill omitted
 *            = no zebra.
 *
 * Precedence is always: per-node override (`style.header` / `style.footer` / `style.zebra`)
 *   > theme > built-in default — so a single table can still pin its own colours over the theme.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode, ThemeInput } from '../../src/index';
import { fontConfig } from '../shared';
import type { CatalogSale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the brand header repeated at the top of every page — logo + company name (same brand-header pattern across the table demos) */
const brandHeader: ReportNodeInput = {
  type: 'row',
  columns: [
    { width: 14, children: [{ type: 'image', data: logo, format: 'PNG', width: 14, height: 14 }] },
    {
      children: [
        { type: 'spacer', height: 2 },
        { content: 'Kapom Report', style: { fontSize: 13, fontStyle: 'bold', color: NAVY } },
        { content: 'kapom-soft', style: { fontSize: 8, color: GRAY } },
      ],
    },
  ],
};

/** one grouped, subtotaled catalog table — identical for every theme; only the theme differs */
function catalogTable(sales: CatalogSale[]): TableNode<CatalogSale> {
  const c = col<CatalogSale>();
  return {
    type: 'table',
    columns: [
      c.rowNumber({ align: 'right', width: 12, mode: 'per-group' }),
      c.data('product', 'Product'),
      c.data('qty', 'Qty', { align: 'right', aggregate: 'sum' }),
      c.data('price', 'Price', { align: 'right', numberFormat: {} }),
      c.computed('Amount', (row) => nativeNumeric.multiply(row.qty, row.price), {
        align: 'right',
        aggregate: 'sum',
        numberFormat: { fractionDigits: 2 },
      }),
    ],
    data: sales,
    summaryLabel: 'Grand Total',
    group: { by: 'region', footerLabel: (key) => `Subtotal ${key}` },
  };
}

/** build the themed report — the body is the same every time; `theme` is the only thing that changes */
export function buildThemedCatalog(sales: CatalogSale[], label: string, theme: ThemeInput): KapomReport {
  const report = reportBuilder<CatalogSale>()
    .font(fontConfig)
    .theme(theme) // ← the whole demo: one argument themes every surface below
    .title(label);

  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  report.content(catalogTable(sales));

  return report.build();
}
