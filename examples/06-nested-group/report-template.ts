/**
 * File 2 of 3 — the report template.
 * Demo — nested group: a group nested 2 levels deep (region → category) via
 * GroupResolver.subGroup — a band at every level (inner level labels are indented), a subtotal
 * per sub-group (the segment's foot), a subtotal per region (a single row on a gray
 * band-matching background), and a grand total at the end. Nests to N levels — each level has
 * its own labels/keepTogether.
 * Compare with 05-group-report, which groups only one level deep.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { BranchSale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the brand header repeated at the top of every page — logo + company name (same pattern as demo 18) */
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

export function buildBranchSales(branchSales: BranchSale[]): KapomReport {
  const c = col<BranchSale>();
  const nestedTable: TableNode<BranchSale> = {
    type: 'table',
    columns: [
      // no leading rowNumber — the subtotal label lands on the first empty cell (the first
      // column); if that were a narrow rowNumber column, a long label would wrap awkwardly
      c.data('product', 'Item'),
      c.data('qty', 'Qty', { align: 'right', aggregate: 'sum' }),
      c.data('price', 'Price', { align: 'right', numberFormat: {} }),
      c.computed('Amount', (row) => nativeNumeric.multiply(row.qty, row.price), { align: 'right', aggregate: 'sum' }),
    ],
    data: branchSales,
    summaryLabel: 'Grand Total',
    group: {
      by: 'region',
      headerLabel: (key) => `Region: ${key}`,
      footerLabel: (key) => `Subtotal — ${key}`,
      keepTogether: { minRowsWithHeader: 2 },
      // one more level inside every region — recursive: a subGroup can have its own subGroup
      subGroup: {
        by: 'category',
        footerLabel: (key) => `Subtotal ${key}`,
      },
    },
  };

  const report = reportBuilder<BranchSale>()
    .font(fontConfig)
    .title('Branch Sales — nested group, region → category');

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  report.content(nestedTable);

  return report.build();
}
