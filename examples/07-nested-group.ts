/**
 * Demo — nested group (roadmap 10)
 * Focus: a group nested 2 levels deep (region → category) via GroupResolver.subGroup —
 * a band at every level (inner level labels are indented), a subtotal per sub-group
 * (the segment's foot), a subtotal per region (a single row on a gray band-matching
 * background), and a grand total at the end;
 * compare with 06-grouped-report.ts, which groups only one level deep
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface RegionSale {
  region: string;
  category: string;
  product: string;
  qty: number;
  price: string;
}

const regions = ['North', 'South', 'East'];
const categories = ['Food', 'Drink'];

const sales: RegionSale[] = regions.flatMap((region, r) =>
  categories.flatMap((category, c) =>
    Array.from({ length: 5 }, (_, i) => ({
      region,
      category,
      product: `Item ${r * 10 + c * 5 + i + 1}`,
      qty: (i % 4) + 1,
      price: `${(i % 50) + 20}.50`,
    })),
  ),
);

const nestedTable: TableNode<RegionSale> = {
  type: 'table',
  columns: [
    // no leading rowNumber — the subtotal label lands on the first empty cell (the first
    // column); if that were a narrow rowNumber column, a long label would wrap awkwardly
    { type: 'data', key: 'product', header: 'Item' },
    { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
    { type: 'data', key: 'price', header: 'Price', align: 'right', numberFormat: {}, aggregate: 'sum' },
  ],
  data: sales,
  summaryLabel: 'Grand Total',
  group: {
    by: 'region',
    headerLabel: (key) => `Region: ${key}`,
    footerLabel: (key) => `Subtotal — ${key}`,
    keepTogether: { minRowsWithHeader: 2 },
    subGroup: {
      by: 'category',
      footerLabel: (key) => `Subtotal ${key}`,
    },
  },
};

const report = createKapomReport<RegionSale>({
  font: fontConfig,
  blocks: [
    {
      type: 'text',
      content: 'Nested group — region → category, 2 levels deep',
      style: { fontSize: 14, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 4 },
    nestedTable,
  ],
});

saveReport(report, '07-nested-group');
