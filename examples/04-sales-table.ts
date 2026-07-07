/**
 * Demo — flat table (AutoTable wrapper)
 * Focus: rowNumber / computed / runningTotal columns + aggregate (sum/avg) + summary row
 * + auto page-break within the table (a long table overflows onto more pages on its own)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport, nativeNumeric } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  qty: number;
  /** string, matching a DECIMAL column from a DB — the lib accepts Decimalish (number|string) as-is, no conversion */
  price: string;
}

const sales: Sale[] = Array.from({ length: 45 }, (_, i) => ({
  product: `Product ${String.fromCharCode(65 + (i % 26))}${i + 1}`,
  qty: (i % 7) + 1,
  price: `${(i % 90) + 10}.${String(i % 100).padStart(2, '0')}`,
}));

const salesTable: TableNode<Sale> = {
  type: 'table',
  columns: [
    { type: 'rowNumber', header: '#', align: 'right', width: 12 },
    { type: 'data', key: 'product', header: 'Product' },
    { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
    {
      type: 'data',
      key: 'price',
      header: 'Unit Price',
      align: 'right',
      headerAlign: 'center',
      numberFormat: {},
      aggregate: 'avg',
    },
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
  data: sales,
  summaryLabel: 'Total',
};

const report = createKapomReport<Sale>({
  font: fontConfig,
  blocks: [
    {
      type: 'text',
      content: 'Sales table — rowNumber / computed / runningTotal + aggregate',
      style: { fontSize: 14, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 4 },
    salesTable,
    { type: 'spacer', height: 6 },
    {
      type: 'text',
      content: 'This line continues right after the table on the last page (proves cursor sync after AutoTable paginates on its own)',
    },
  ],
});

saveReport(report, '04-sales-table');
