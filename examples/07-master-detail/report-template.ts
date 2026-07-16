/**
 * File 2 of 3 — the report template.
 * Demo — master-detail (nested tables): `TableNode.nested` returns a sub-table per row.
 * This demo prints the *same* batches twice, one section per `nestedLayout`, so the two can be
 * compared side by side (section 2 starts on a fresh page via pageBreak()):
 *
 *   1. 'stacked'  — each batch is a self-contained block: master header + that batch's values
 *                   (identity band) + child header + payments, at full width. All three head rows
 *                   repeat on a page break, so an overflowing batch still shows which batch it is.
 *   2. 'below'    — the child renders indented under its master row; `nestedIndentColumn` picks
 *                   the master column its left edge lines up with (grid-aligned, computed from the
 *                   master's own resolved widths). Indenting past column 0 leaves the child at
 *                   roughly 80% width, flush with the master's right edge. On a page break only
 *                   the *child's* header repeats — the master row stays behind on the earlier page.
 *
 * A different concept from 06-nested-group: nested *groups* subdivide the same rows; a nested
 * *table* attaches a whole child table to one master row.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageBreak, reportBuilder, spacer } from '../../src/index';
import type { KapomReport, ReportColumn, ReportNodeInput, RGB, TableNode } from '../../src/index';
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

/** the master columns — shared by both sections so only the layout differs between them */
const masterColumns: ReportColumn<Batch>[] = [
  { key: 'batchName', header: 'Batch Name' }, // `type: 'data'` is the default — omit it
  { key: 'type', header: 'Type' },
  { key: 'openDate', header: 'Open Date' },
  { key: 'bank', header: 'Bank' },
  { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  { key: 'sumPayments', header: 'Sum Payments', align: 'right', numberFormat: {}, aggregate: 'sum' },
];

/** the detail table for one batch — `undefined` would mean "this row has no detail to show" */
const paymentsOf = (row: Batch): TableNode<unknown> | undefined =>
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
  } satisfies TableNode<Payment> as unknown as TableNode<unknown>);

export function buildBatchReport(batches: Batch[]): KapomReport {
  const stackedTable: TableNode<Batch> = {
    type: 'table',
    columns: masterColumns,
    data: batches,
    summaryLabel: 'Grand Total',
    nested: paymentsOf,
    nestedLayout: 'stacked',
  };

  const belowTable: TableNode<Batch> = {
    type: 'table',
    columns: masterColumns,
    data: batches,
    summaryLabel: 'Grand Total',
    nested: paymentsOf,
    nestedLayout: 'below', // the default — spelled out here to contrast with the section above
    // start the child at master column 1 ("Type"), i.e. indented past "Batch Name" — the child
    // ends up ~80% wide, its right edge flush with the master's
    nestedIndentColumn: 1,
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

  report.content(
    {
      content: "1. nestedLayout: 'stacked' — full width; the master identity repeats on every page",
      role: 'sectionHeading',
    },
    spacer(3),
    stackedTable,

    pageBreak(),

    {
      content: "2. nestedLayout: 'below' + nestedIndentColumn: 1 — child indented to ~80%, flush right",
      role: 'sectionHeading',
    },
    spacer(3),
    belowTable,
  );

  return report.build();
}
