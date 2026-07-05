/**
 * Demo — Signature Block + Watermark (roadmap 6d)
 * โฟกัส: { type: 'signature' } เส้นเซ็นชื่อ+label หลาย slot เป็น Report Footer
 * และ watermark preset `{ text: 'DRAFT' }` — แค่ระบุข้อความก็ได้ตราจางกลางหน้า
 * ทุกหน้า (opacity/fontSize/สี default ให้; ต้องการ custom เต็มรูปยังเขียน
 * render callback + withOpacity() เองได้ — ดู core/watermark.ts)
 * เรียกผ่าน createKapomReport({ blocks, watermark }) — facade เรียก finalize() ให้เอง
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 30 }, (_, i) => ({
  product: `Product ${i + 1}`,
  qty: (i % 5) + 1,
}));

const salesTable: TableNode<Sale> = {
  type: 'table',
  columns: [
    { type: 'data', key: 'product', header: 'Product' },
    { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
};

const report = createKapomReport<Sale>({
  font: fontConfig,
  // preset — จัดกึ่งกลางหน้า + opacity 0.15 + fontSize 60 + สีเทาให้เอง (override ได้ทุกค่า)
  watermark: { text: 'DRAFT' },
  blocks: [
    { type: 'text', content: 'Monthly Sales Report', role: 'reportTitle' },
    { type: 'spacer', height: 6 },
    salesTable,
    { type: 'spacer', height: 20 },
    {
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำ' }, { label: 'ผู้ตรวจสอบ' }, { label: 'ผู้อนุมัติ' }],
    },
  ],
});

saveReport(report, '08-signature-watermark');
