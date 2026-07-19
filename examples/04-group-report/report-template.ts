/**
 * File 2 of 3 — the report template.
 * Demo — grouped table (composite): a gray band per group + per-group rowNumber + a subtotal
 * per group + a grand total at the end.
 * Focus:
 *   group        — full GroupResolver: custom headerLabel / footerLabel per group
 *   rowNumber    — `mode: 'per-group'` resets the counter at every group (vs 'continuous')
 *   keepTogether — a band never gets stranded alone at the bottom of a page
 *                  (minRowsWithHeader: the band only starts if ≥ N data rows fit under it)
 * Compare with 05-nested-group, which nests a second group level inside this shape.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB } from '../../src/index';
import { fontConfig } from '../shared';
import type { RegionSale } from './data';

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

/** compose a grouped, subtotaled sales table from raw rows */
export function buildRegionalSales(regionSales: RegionSale[]): KapomReport {
  const c = col<RegionSale>();

  // `.table()` takes the single-table config directly — column/group shorthands and all — so the
  // whole table lives in the chain, no separate `TableNode` object literal or `.content()` needed
  const report = reportBuilder<RegionSale>()
    .font(fontConfig)
    .title('Regional Sales — grouped, subtotaled, grand total')
    .table({
      columns: [
        c.rowNumber({ align: 'right', width: 12, mode: 'per-group' }),
        c.data('product', 'Product'),
        c.data('qty', 'Qty', { align: 'right', aggregate: 'sum' }),
        c.data('price', 'Price', { align: 'right', numberFormat: {} }),
        c.computed('Amount', (row) => nativeNumeric.multiply(row.qty, row.price), {
          align: 'right',
          aggregate: 'sum',
          numberFormat: { fractionDigits: 2 }, // shorthand — one value sets min and max fraction digits
        }),
      ],
      data: regionSales,
      summaryLabel: 'Grand Total',
      group: {
        by: 'region',
        headerLabel: (key, rows) => `Region: ${key} (${rows.length} items)`,
        footerLabel: (key) => `Subtotal ${key}`,
        keepTogether: { minRowsWithHeader: 2 },
      },
    });

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  return report.build();
}
