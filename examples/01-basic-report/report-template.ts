/**
 * File 2 of 3 — the report template.
 * One report that joins three tables with `pageBreak()`, each showing a different feature set:
 *   1. the smallest table (product + qty) — `{ key, header }`, `type: 'data'` omitted
 *   2. zebra + conditional formatting + a formatter + column-level cellStyle
 *   3. rowNumber / computed / runningTotal columns + aggregates (summary row)
 * Assembled with the `reportBuilder()` chain: `.title()` once at the top, `.content()` for the
 * flow, `pageBreak()` between sections so each table starts on a fresh page.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { divider, formatDate, nativeNumeric, pageBreak, reportBuilder, spacer } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { LedgerEntry, OrderLine, Sale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the brand page header repeated at the top of every page — logo + company name */
const brandHeader: ReportNodeInput = {
  type: 'row',
  columns: [
    { width: 14, children: [{ type: 'image', data: logo, format: 'PNG', width: 14, height: 14 }] },
    {
      children: [
        spacer(2),
        { content: 'Kapom Company', style: { fontSize: 13, fontStyle: 'bold', color: NAVY } },
        { content: 'kapom-soft', style: { fontSize: 8, color: GRAY } },
      ],
    },
  ],
};

/**
 * `TableNode<T>` is invariant in T (its columns reference `keyof T`), so tables of different row
 * types can't sit in one `ReportNode<unknown>` flow directly — this one cast bridges them (the same
 * thing `ReportRegistry` does internally). It's the price of mixing row types in a single report.
 */
const untyped = <T>(table: TableNode<T>): TableNode<unknown> => table as unknown as TableNode<unknown>;

/** small section heading above each table */
const heading = (text: string): { content: string; role: 'sectionHeading' } => ({ content: text, role: 'sectionHeading' });

export function buildCombinedReport(sales: Sale[], ledger: LedgerEntry[], orders: OrderLine[]): KapomReport {
  // ── 1. the smallest table — columns are just { key, header } ──
  const salesTable: TableNode<Sale> = {
    type: 'table',
    columns: [
      { key: 'product', header: 'Product' },
      { key: 'qty', header: 'Qty', align: 'right' },
    ],
    data: sales,
  };

  // ── 2. zebra + conditional (negative = red) + formatter + column-level cellStyle ──
  const ledgerTable: TableNode<LedgerEntry> = {
    type: 'table',
    columns: [
      {
        key: 'date',
        header: 'Date',
        width: 30,
        formatter: (value) => formatDate(new Date(String(value)), { locale: 'en-GB', dateStyle: 'medium' }),
      },
      { key: 'description', header: 'Description' },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        width: 35,
        numberFormat: {}, // {} = DEFAULT_NUMBER_FORMAT (thousands separator + 2 decimals)
        aggregate: 'sum',
        cellStyle: { fontFamily: 'Sarabun' }, // ranks below zebra/conditional in precedence
      },
    ],
    data: ledger,
    summaryLabel: 'Net',
    style: {
      zebra: { even: [255, 255, 255], odd: [245, 247, 250] },
      conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
    },
  };

  // ── 3. every column kind + aggregates; overflows onto more pages (AutoTable paginates itself) ──
  const orderTable: TableNode<OrderLine> = {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right', width: 12 },
      { key: 'product', header: 'Product' },
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
    data: orders,
    summaryLabel: 'Total',
  };

  const report = reportBuilder()
    .font(fontConfig)
    .title('Combined Report — basic, styled, and aggregate tables');

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock(spacer(1.5))
    .addBlock(divider({ thickness: 0.2, color: RULE }))
    .addBlock(spacer(2));

  report.content(
    heading('1. Daily Sales — the smallest table'),
    spacer(3),
    untyped(salesTable),
    pageBreak(), // ← section 2 starts on a fresh page

    heading('2. Ledger — zebra + conditional (negative = red)'),
    spacer(3),
    untyped(ledgerTable),
    pageBreak(), // ← section 3 starts on a fresh page

    heading('3. Order summary — rowNumber / computed / runningTotal + aggregate'),
    spacer(3),
    untyped(orderTable),
  );

  return report.build();
}
