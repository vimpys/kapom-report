/**
 * Demo — สร้าง PDF จริงด้วย RenderEngine + Text/Spacer/Divider/Image/Table blocks
 * ลงทะเบียน font ไทยจริง (Sarabun, OFL) ผ่าน font registry — ข้อความไทยแสดงผลถูกต้องแล้ว
 * รัน: npm run demo
 * ผลลัพธ์: examples/output/basic-report.pdf
 */
import { jsPDF } from 'jspdf';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RenderEngine, createBlock, nativeNumeric } from '../src/index';
import type { FontConfig, TableNode } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '../tests/fixtures/fonts');

const fontConfig: FontConfig = {
  fonts: [
    { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Regular.ttf'))), style: 'normal' },
    { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Bold.ttf'))), style: 'bold' },
  ],
};

interface Sale {
  product: string;
  qty: number;
  /** string ตาม DECIMAL จาก DB — ระบบรับ Decimalish ตรงๆ */
  price: string;
}

const sales: Sale[] = Array.from({ length: 45 }, (_, i) => ({
  product: `Product ${String.fromCharCode(65 + (i % 26))}${i + 1}`,
  qty: (i % 7) + 1,
  price: `${(i % 90) + 10}.${String(i % 100).padStart(2, '0')}`,
}));

interface RegionSale extends Sale {
  region: string;
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

interface LedgerEntry {
  description: string;
  amount: number;
}

const ledgerEntries: LedgerEntry[] = [
  { description: 'Opening balance', amount: 5000 },
  { description: 'Client payment — Invoice #101', amount: 1200 },
  { description: 'Office rent', amount: -800 },
  { description: 'Software subscription', amount: -150 },
  { description: 'Client payment — Invoice #102', amount: 2400 },
  { description: 'Refund — Invoice #099', amount: -300 },
  { description: 'Consulting fee', amount: 900 },
];

const ledgerTable: TableNode<LedgerEntry> = {
  type: 'table',
  columns: [
    { type: 'data', key: 'description', header: 'Description' },
    { type: 'data', key: 'amount', header: 'Amount', align: 'right', numberFormat: {}, aggregate: 'sum' },
  ],
  data: ledgerEntries,
  summaryLabel: 'Net',
  style: {
    zebra: { even: [255, 255, 255], odd: [245, 247, 250] },
    conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
  },
};

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

const outDir = join(here, 'output');
const outFile = join(outDir, 'basic-report.pdf');

const doc = new jsPDF();
const engine = new RenderEngine(doc, { font: fontConfig });

const repeatedParagraph =
  'ข้อความตัวอย่างสำหรับทดสอบการตัดบรรทัดอัตโนมัติ (word wrap) ของ PdfCursor engine เมื่อความกว้างไม่พอสำหรับหนึ่งบรรทัด engine จะคำนวณจำนวนบรรทัดจริงผ่าน jsPDF splitTextToSize แล้วเลื่อน cursor ลงตามความสูงที่วัดได้ ';

/** 1x1 PNG โปร่งใส — ใช้แทนโลโก้จริงเพื่อทดสอบ addImage() + auto-scale ลง contentWidth */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

engine.render([
  createBlock({
    type: 'text',
    content: 'Kapom Report — ตัวอย่างรายงานพื้นฐาน',
    style: { fontSize: 18, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock({
    type: 'text',
    content: 'สร้างเมื่อ 2026-07-05 โดย RenderEngine + createBlock()',
    style: { fontSize: 10, color: [100, 100, 100] },
  }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({ type: 'divider' }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({
    type: 'image',
    data: TINY_PNG_BASE64,
    format: 'PNG',
    width: 400, // เกิน contentWidth ~180mm ตั้งใจ → ทดสอบ auto-scale ลง
    height: 400,
  }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({ type: 'text', content: repeatedParagraph.repeat(3) }),
  createBlock({ type: 'spacer', height: 10 }),
  createBlock({ type: 'divider', thickness: 1, color: [200, 0, 0] }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock({
    type: 'text',
    content: 'ทดสอบ auto page-break: บรรทัดซ้ำด้านล่างนี้จะดันเนื้อหาล้นไปหน้าถัดไปโดยอัตโนมัติ',
    style: { fontStyle: 'bold' },
  }),
  ...Array.from({ length: 80 }, (_, i) =>
    createBlock({
      type: 'text',
      content: `บรรทัดทดสอบที่ ${i + 1} — เนื้อหาซ้ำเพื่อยืนยันว่า RenderEngine ขึ้นหน้าใหม่เองเมื่อพื้นที่ไม่พอ`,
    }),
  ),
  createBlock({ type: 'spacer', height: 8 }),
  createBlock({
    type: 'text',
    content: 'Sales table — AutoTable + rowNumber/computed/runningTotal + aggregate (sum/avg)',
    style: { fontSize: 12, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock(salesTable),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({
    type: 'text',
    content: 'บรรทัดนี้ต้องต่อจากท้ายตารางบนหน้าสุดท้ายของตาราง (พิสูจน์ cursor sync หลัง AutoTable)',
  }),
  createBlock({ type: 'spacer', height: 8 }),
  createBlock({
    type: 'text',
    content: 'Grouped table — group band ต่อ region + per-group rowNumber + subtotal + grand total',
    style: { fontSize: 12, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock(groupedTable),
  createBlock({ type: 'spacer', height: 8 }),
  createBlock({
    type: 'text',
    content: 'Ledger — zebra striping + conditional formatting (negative = red), precedence: conditional > zebra',
    style: { fontSize: 12, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock(ledgerTable),
]);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, Buffer.from(doc.output('arraybuffer')));

console.log(`สร้าง PDF สำเร็จ: ${outFile}`);
console.log(`จำนวนหน้า: ${doc.getNumberOfPages()}`);
