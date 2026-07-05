/**
 * Demo — Signature Block + Watermark (roadmap 6d)
 * โฟกัส: { type: 'signature' } เส้นเซ็นชื่อ+label หลาย slot เป็น Report Footer
 * และ watermark ซ้ำทุกหน้าผ่าน withOpacity() คุม opacity ให้ดู "อยู่ใต้" content
 * (จริงๆ วาดทับเสมอ เพราะ jsPDF ไม่มี z-order — ดู core/watermark.ts)
 * เรียกผ่าน createKapomReport({ blocks, watermark }) — facade เรียก finalize() ให้เอง
 */
import { createKapomReport, withOpacity } from '../src/index';
import type { TableNode, Watermark } from '../src/index';
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

const draftWatermark: Watermark = {
  render: (ctx) => {
    // withOpacity set GState ก่อนวาดแล้ว reset กลับ 1 ให้เอง — ไม่ต้อง import GState จาก jspdf
    withOpacity(ctx.doc, 0.15, () => {
      ctx.doc.setFontSize(60);
      ctx.doc.setTextColor(150, 150, 150);
      ctx.drawText('DRAFT', ctx.pageWidth / 2 - 45, ctx.pageHeight / 2);
    });
  },
};

const report = createKapomReport<Sale>({
  font: fontConfig,
  watermark: draftWatermark,
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
