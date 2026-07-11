/**
 * File 2 of 3 — the report template.
 * Data-agnostic: everything about how the report *looks* lives here (columns, currency
 * formatting, the repeating header banner, zebra striping, page numbers), exposed as a single
 * `buildSalesReport(sales, options)` function. Swap in any `Sale[]` — or a different company
 * name — and get the same formatted, paginated report. The data itself lives in data.ts.
 */
import { createAnchoredBand, createKapomReport } from '../../src/index';
import type { KapomReport, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

const NAVY: RGB = [31, 63, 112];
const ZEBRA: RGB = [240, 244, 249];

/** "$1,170.00" for a positive amount, an accounting dash for zero */
const money = (n: number): string =>
  n > 0 ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

const quarter = (key: 'q1' | 'q2' | 'q3' | 'q4', header: string): TableNode<Sale>['columns'][number] => ({
  type: 'data',
  key,
  header,
  align: 'right',
  width: 24,
  formatter: (value) => money(Number(value)),
});

export interface SalesReportOptions {
  companyName: string;
  /** shown on the right of the header band — default 'Sales Report' */
  title?: string;
}

/** compose a paginated, formatted sales report from raw rows + presentation options */
export function buildSalesReport(sales: Sale[], options: SalesReportOptions): KapomReport {
  const salesTable: TableNode<Sale> = {
    type: 'table',
    columns: [
      { type: 'data', key: 'product', header: 'Product', width: 34 },
      { type: 'data', key: 'customer', header: 'Customer', width: 24 },
      quarter('q1', 'Qtr 1'),
      quarter('q2', 'Qtr 2'),
      quarter('q3', 'Qtr 3'),
      quarter('q4', 'Qtr 4'),
      {
        type: 'computed',
        header: 'Total',
        align: 'right',
        width: 26,
        compute: (row) => row.q1 + row.q2 + row.q3 + row.q4,
        formatter: (value) => money(Number(value)),
        cellStyle: { fontStyle: 'bold' },
      },
    ],
    data: sales,
    style: { header: { fillColor: NAVY }, zebra: { even: ZEBRA } },
  };

  return createKapomReport<Sale>({
    font: fontConfig,
    pageHeader: createAnchoredBand({
      height: 16,
      anchors: [
        { align: 'left', format: options.companyName, style: { fontSize: 13, fontStyle: 'bold', color: [30, 30, 30] } },
        { align: 'right', format: options.title ?? 'Sales Report', style: { fontSize: 18, fontStyle: 'bold', color: NAVY } },
      ],
    }),
    pageNumber: { position: 'bottom-center', format: 'Page {pageNumber} of {totalPages}' },
    blocks: [salesTable],
  });
}
