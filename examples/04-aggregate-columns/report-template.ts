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
import { nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { OrderLine } from './data';

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

  return reportBuilder<OrderLine>()
    .font(fontConfig)
    .title('Order summary — rowNumber / computed / runningTotal + aggregate')
    .content(
      orderTable,
      { type: 'spacer', height: 6 },
      'This line continues right after the table on the last page (proves cursor sync after AutoTable paginates on its own)',
    )
    .build();
}
