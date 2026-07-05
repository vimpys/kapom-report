/**
 * Demo — Page Header/Footer band (roadmap 6a)
 * โฟกัส: reserved height หักจาก content area, band วาดซ้ำทุกหน้ารวมหน้าที่ AutoTable
 * สร้างเอง (ไม่ใช่แค่หน้าที่ engine.breakPage ทำ), "หน้า X จาก Y" รู้ pageCount จริงตอน finalize
 * เรียกผ่าน createKapomReport({ blocks, pageHeader, pageFooter }) — facade เรียก finalize() ให้เอง
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Row {
  n: number;
  label: string;
}

const rows: Row[] = Array.from({ length: 80 }, (_, i) => ({
  n: i + 1,
  label: `รายการที่ ${i + 1} — เนื้อหาตัวอย่างสำหรับดันตารางให้ยาวข้ามหลายหน้า`,
}));

const bigTable: TableNode<Row> = {
  type: 'table',
  columns: [
    { type: 'rowNumber', header: '#', align: 'right', width: 12 },
    { type: 'data', key: 'label', header: 'รายการ' },
  ],
  data: rows,
};

const report = createKapomReport<Row>({
  font: fontConfig,
  // page header — ซ้ำทุกหน้า, กินพื้นที่สงวน 16mm บนสุด (content เริ่มใต้เส้นนี้)
  pageHeader: {
    height: 16,
    render: (c) => {
      c.doc.setFontSize(9);
      c.doc.setFont('Sarabun', 'bold');
      c.doc.setTextColor(41, 128, 185);
      c.drawText('Kapom Report — Demo', c.x, c.y + 8);
      c.doc.setDrawColor(41, 128, 185);
      c.doc.setLineWidth(0.3);
      c.doc.line(c.x, c.y + c.height - 1, c.x + c.width, c.y + c.height - 1);
    },
  },
  // page footer — เลขหน้า "X / total" (pageCount รู้ตอน finalize จริง — facade เรียกให้)
  pageFooter: {
    height: 12,
    render: (c) => {
      c.doc.setFontSize(8);
      c.doc.setFont('Sarabun', 'normal');
      c.doc.setTextColor(120, 120, 120);
      c.drawText(`หน้า ${c.pageIndex + 1} จาก ${c.pageCount}`, c.x + c.width - 40, c.y + 6);
      c.drawText('สร้างโดย kapom-report', c.x, c.y + 6);
    },
  },
  // ตารางอยู่บล็อกแรก — cursor อยู่ที่ contentTop พอดี (ใต้ header) ตารางจึงเริ่มหน้า 1 ทันที
  // แทนที่จะโดน ensureSpace เลื่อนไปหน้า 2 (ตาราง 80 แถวยาวกว่า 1 หน้าเสมอ — ถ้ามี block
  // อื่นมาก่อนแล้ว cursor ไม่ได้อยู่หัวหน้า engine จะ break ก่อนเริ่ม กันตารางเริ่มแล้วโดนตัดทันที)
  blocks: [
    bigTable,
    { type: 'spacer', height: 6 },
    {
      type: 'text',
      content: 'ตารางยาวข้ามหลายหน้า — header/footer ขึ้นครบทุกหน้า รวมหน้าที่ AutoTable สร้างเอง',
      style: { fontSize: 10, fontStyle: 'bold' },
    },
  ],
});

saveReport(report, '05-page-header-footer');
