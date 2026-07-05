/**
 * Demo — flat table (AutoTable wrapper)
 * โฟกัส: rowNumber / computed / runningTotal column + aggregate (sum/avg) + summary row
 * + auto page-break ภายในตาราง (ตารางยาวข้ามหน้าเอง)
 */
import { jsPDF } from 'jspdf';
import { RenderEngine, createBlock, nativeNumeric } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, save } from './shared';

interface Sale {
  product: string;
  qty: number;
  /** string ตาม DECIMAL จาก DB — ระบบรับ Decimalish (number|string) ตรงๆ ไม่แปลง */
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

const doc = new jsPDF();
const engine = new RenderEngine(doc, { font: fontConfig });

engine.render([
  createBlock({
    type: 'text',
    content: 'Sales table — rowNumber / computed / runningTotal + aggregate',
    style: { fontSize: 14, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock(salesTable),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({
    type: 'text',
    content: 'บรรทัดนี้ต่อจากท้ายตารางบนหน้าสุดท้าย (พิสูจน์ cursor sync หลัง AutoTable แบ่งหน้าเอง)',
  }),
]);

save(doc, '02-sales-table');
