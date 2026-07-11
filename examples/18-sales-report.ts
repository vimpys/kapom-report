/**
 * Demo — Sales Report (multi-page paginated table with a repeating header + page numbers)
 * Focus: a flat table long enough to span two pages — the table is the first in-flow block so it
 * starts at the top of the content area and paginates cleanly (AutoTable adds pages itself); the
 * header banner repeats on every page via a pageHeader band, and `pageNumber` prints "Page X of Y"
 * in the bottom margin without costing the content area any height. Currency cells use a column
 * `formatter` (the library's NumberFormat has no currency style — a formatter callback is how you
 * get a "$" prefix); no aggregate row here, since a formatter isn't applied to aggregate cells.
 */
import { createKapomReport, createAnchoredBand } from '../src/index';
import type { RGB, TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

const NAVY: RGB = [31, 63, 112];
const ZEBRA: RGB = [240, 244, 249];

interface Sale {
  product: string;
  customer: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

// [product, [customer, q1, q2, q3, q4][]] — some quarters are 0 (shown as a dash)
const catalog: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, number, number, number, number]>]> = [
  ['Alice Mutton', [
    ['ANTON', 0, 702, 0, 0], ['BERGS', 312, 0, 0, 0], ['BOLID', 0, 0, 0, 1170],
    ['BOTTM', 1170, 0, 0, 0], ['ERNSH', 1123.2, 0, 2607.15, 0], ['GODOS', 0, 280.8, 0, 0],
    ['HUNGC', 62.4, 0, 0, 0], ['PICCO', 0, 1560, 936, 0], ['RATTC', 0, 592.8, 0, 0],
  ]],
  ['Aniseed Syrup', [
    ['ALFKI', 0, 60, 0, 0], ['BOTTM', 0, 200, 0, 0], ['ERNSH', 0, 0, 180, 0],
    ['LINOD', 544, 0, 0, 0], ['QUICK', 0, 600, 0, 0], ['VAFFE', 0, 0, 140, 0],
  ]],
  ['Boston Crab Meat', [
    ['ANTON', 0, 165.6, 0, 0], ['BERGS', 920, 0, 0, 0], ['BONAP', 248.4, 524.4, 0, 0],
    ['BOTTM', 551.25, 0, 0, 0], ['BSBEV', 147, 0, 0, 0], ['FRANS', 0, 0, 18.4, 0],
    ['HILAA', 0, 1104, 0, 0], ['LAZYK', 147, 0, 0, 0], ['LEHMS', 0, 515.2, 0, 0],
  ]],
  ['Camembert Pierrot', [
    ['ANTON', 0, 0, 340, 0], ['BERGS', 1088, 0, 0, 0], ['FOLKO', 0, 850, 0, 0],
    ['LILAS', 0, 0, 0, 1275], ['MEREP', 476, 0, 0, 0], ['SAVEA', 0, 2380, 0, 0],
  ]],
  ['Chai', [
    ['ALFKI', 0, 0, 288, 0], ['BOTTM', 612, 0, 0, 0], ['ERNSH', 0, 0, 0, 900],
    ['LEHMS', 0, 342, 0, 0], ['QUICK', 720, 0, 0, 0], ['VINET', 0, 0, 108, 0],
  ]],
  ['Chang', [
    ['BERGS', 0, 380, 0, 0], ['BLONP', 340, 0, 0, 0], ['ERNSH', 0, 0, 1520, 0],
    ['FRANK', 0, 855, 0, 0], ['QUICK', 0, 0, 0, 646], ['WARTH', 190, 0, 0, 0],
  ]],
  ['Gorgonzola Telino', [
    ['ANTON', 0, 250, 0, 0], ['BONAP', 500, 0, 0, 0], ['LAMAI', 0, 0, 750, 0],
    ['ROMEY', 0, 300, 0, 0], ['SAVEA', 1000, 0, 0, 0], ['WHITC', 0, 0, 0, 450],
  ]],
];

const sales: Sale[] = catalog.flatMap(([product, rows]) =>
  rows.map(([customer, q1, q2, q3, q4]) => ({ product, customer, q1, q2, q3, q4 })),
);

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

const report = createKapomReport<Sale>({
  font: fontConfig,
  // banner repeats on every page — a band keeps the table as the first in-flow block, so it
  // starts at the top of the content area and paginates cleanly instead of being pushed to page 2
  pageHeader: createAnchoredBand({
    height: 16,
    anchors: [
      { align: 'left', format: '[COMPANY NAME]', style: { fontSize: 13, fontStyle: 'bold', color: [30, 30, 30] } },
      { align: 'right', format: 'Sales Report', style: { fontSize: 18, fontStyle: 'bold', color: NAVY } },
    ],
  }),
  pageNumber: { position: 'bottom-center', format: 'Page {pageNumber} of {totalPages}' },
  blocks: [salesTable],
});

saveReport(report, '18-sales-report');
