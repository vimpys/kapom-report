/**
 * Demo — grouped table (composite)
 * โฟกัส: group band ต่อกลุ่ม + per-group rowNumber + subtotal ต่อกลุ่ม + grand total
 * + keep-together (band ไม่ตกท้ายหน้าเดียวดาย)
 * เรียกผ่าน createKapomReport({ blocks }) — ไม่ต้องแตะ jsPDF/RenderEngine เอง
 */
import { createKapomReport, nativeNumeric } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface RegionSale {
  region: string;
  product: string;
  qty: number;
  price: string;
}

const regionSales: RegionSale[] = ['North', 'South', 'East'].flatMap((region, r) =>
  Array.from({ length: 8 }, (_, i) => ({
    region,
    product: `Item ${r * 8 + i + 1}`,
    qty: (i % 4) + 1,
    price: `${(i % 50) + 20}.50`,
  })),
);

const groupedTable: TableNode<RegionSale> = {
  type: 'table',
  columns: [
    { type: 'rowNumber', header: '#', align: 'right', width: 12, mode: 'per-group' },
    { type: 'data', key: 'product', header: 'Product' },
    { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
    { type: 'data', key: 'price', header: 'Price', align: 'right', numberFormat: {}, aggregate: 'sum' },
    {
      type: 'computed',
      header: 'Amount',
      align: 'right',
      compute: (row) => nativeNumeric.multiply(row.qty, row.price),
      aggregate: 'sum',
    },
  ],
  data: regionSales,
  summaryLabel: 'Grand Total',
  group: {
    by: 'region',
    headerLabel: (key, rows) => `Region: ${key} (${rows.length} items)`,
    footerLabel: (key) => `Subtotal ${key}`,
    keepTogether: { minRowsWithHeader: 2 },
  },
};

const report = createKapomReport<RegionSale>({
  font: fontConfig,
  blocks: [
    {
      type: 'text',
      content: 'Grouped table — band + per-group rowNumber + subtotal + grand total',
      style: { fontSize: 14, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 4 },
    groupedTable,
  ],
});

saveReport(report, '03-grouped-report');
