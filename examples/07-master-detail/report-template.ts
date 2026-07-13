/**
 * File 2 of 3 — the report template.
 * Demo — master-detail (nested tables): `TableNode.nested` returns a sub-table per row — a row
 * with a child table renders it indented right underneath; `nestedIndentColumn` picks which
 * column of the master table the child's left edge lines up with (grid-aligned, computed from
 * the master's own resolved column widths — not an approximate offset).
 * The batch with 35 payments forces the child table to overflow onto its own extra page; the
 * indent stays put across that break and the master table correctly resumes afterward with the
 * remaining batches + grand total.
 * A different concept from 06-nested-group: nested *groups* subdivide the same rows; a nested
 * *table* attaches a whole child table to one master row.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { Batch, Payment } from './data';

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

export function buildBatchReport(batches: Batch[]): KapomReport {
  const batchTable: TableNode<Batch> = {
    type: 'table',
    columns: [
      { key: 'batchName', header: 'Batch Name' }, // `type: 'data'` is the default — omit it
      { key: 'type', header: 'Type' },
      { key: 'openDate', header: 'Open Date' },
      { key: 'bank', header: 'Bank' },
      { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { key: 'sumPayments', header: 'Sum Payments', align: 'right', numberFormat: {}, aggregate: 'sum' },
    ],
    data: batches,
    summaryLabel: 'Grand Total',
    // undefined = this row has no detail to show — only 'HF/GSP 949027' returns a real child table
    nested: (row) =>
      row.payments && ({
        type: 'table',
        columns: [
          { key: 'date', header: 'Date' },
          { key: 'card', header: 'Card#' },
          { key: 'method', header: 'Method' },
          { key: 'billingStatus', header: 'Billing Status' },
          { key: 'amount', header: 'Amount', align: 'right', numberFormat: {} },
        ],
        data: row.payments,
      } satisfies TableNode<Payment> as unknown as TableNode<unknown>),
    // the child's left edge lines up with column 3 ("Bank") of the master table
    nestedIndentColumn: 3,
  };

  const report = reportBuilder<Batch>()
    .font(fontConfig)
    .title('Payment Batches — master-detail, a sub-table per row');

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  report.content(batchTable);

  return report.build();
}
