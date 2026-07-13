/**
 * File 2 of 3 — the report template.
 * Demo — every column type of a flat table, plus aggregates:
 *   rowNumber  — auto-numbered rows (continuous by default)
 *   data       — plain field columns; `aggregate: 'sum' | 'avg' | ...` adds it to the summary row
 *   computed   — a value derived per row (qty × price) via NumericStrategy (never `a * b` inline)
 *   runningTotal — a cumulative column over a per-row value
 * The 45 rows overflow onto more pages — AutoTable paginates the table on its own, and the
 * text block after the table proves the cursor resumes correctly on the last page.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { OrderLine } from './data';

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
        { content: 'Kapom Company', style: { fontSize: 13, fontStyle: 'bold', color: NAVY } },
        { content: 'kapom-soft', style: { fontSize: 8, color: GRAY } },
      ],
    },
  ],
};

export function buildOrderSummary(orderLines: OrderLine[]): KapomReport {
  const orderTable: TableNode<OrderLine> = {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right', width: 12 },
      { key: 'product', header: 'Product' }, // `type: 'data'` is the default — omit it
      { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { key: 'price', header: 'Unit Price', align: 'right', numberFormat: {}, aggregate: 'avg' },
      {
        type: 'computed',
        header: 'Amount',
        align: 'right',
        compute: (row) => nativeNumeric.multiply(row.qty, row.price),
        aggregate: 'sum',
      },
      {
        type: 'runningTotal',
        header: 'Running',
        align: 'right',
        valueOf: (row) => nativeNumeric.multiply(row.qty, row.price),
      },
    ],
    data: orderLines,
    summaryLabel: 'Total',
  };

  const report = reportBuilder<OrderLine>()
    .font(fontConfig)
    .title('Order summary — rowNumber / computed / runningTotal + aggregate');

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  report.content(
    orderTable,
    { type: 'spacer', height: 6 },
    'This line continues right after the table on the last page (proves cursor sync after AutoTable paginates on its own)',
  );

  return report.build();
}
