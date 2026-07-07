/**
 * Demo — grouped table (composite)
 * Focus: a group band per group + per-group rowNumber + subtotal per group + grand total
 * + keep-together (a band never gets stranded alone at the bottom of a page)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
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

/** the same catalog sold in every region, at a fixed unit price — only sales volume differs by region */
interface CatalogItem {
  name: string;
  price: string;
  qtyByRegion: Record<string, number>;
}

const catalog: CatalogItem[] = [
  { name: 'Wireless Mouse', price: '19.99', qtyByRegion: { 'North America': 42, Europe: 31, 'Asia Pacific': 68 } },
  { name: 'Mechanical Keyboard', price: '59.99', qtyByRegion: { 'North America': 18, Europe: 24, 'Asia Pacific': 35 } },
  { name: 'USB-C Hub', price: '34.50', qtyByRegion: { 'North America': 27, Europe: 19, 'Asia Pacific': 44 } },
  { name: '27" Monitor', price: '219.00', qtyByRegion: { 'North America': 9, Europe: 12, 'Asia Pacific': 15 } },
  { name: 'Webcam HD', price: '45.00', qtyByRegion: { 'North America': 21, Europe: 16, 'Asia Pacific': 29 } },
  { name: 'Laptop Stand', price: '29.90', qtyByRegion: { 'North America': 33, Europe: 22, 'Asia Pacific': 40 } },
  { name: 'Desk Lamp', price: '24.50', qtyByRegion: { 'North America': 14, Europe: 10, 'Asia Pacific': 23 } },
  { name: 'Noise-Cancelling Headphones', price: '89.99', qtyByRegion: { 'North America': 11, Europe: 8, 'Asia Pacific': 17 } },
];

const regions = ['North America', 'Europe', 'Asia Pacific'];

const regionSales: RegionSale[] = regions.flatMap((region) =>
  catalog.map((item) => ({
    region,
    product: item.name,
    qty: item.qtyByRegion[region] ?? 0,
    price: item.price,
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
      numberFormat: { fractionDigits: 4 },
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
