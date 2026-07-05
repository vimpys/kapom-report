/**
 * Demo — SystemField + Anchor Position (roadmap 7)
 * โฟกัส: createAnchoredBand() ประกอบ Anchor[] เป็น PageBand เดียว แทนที่จะเขียน
 * render callback มือเองแบบ 05-page-header-footer — format string ใช้ {token}
 * (pageNumber/totalPages/date/time/dateTime) แทนที่ผ่าน SystemField resolver
 * เรียกผ่าน createKapomReport({ blocks, pageHeader, pageFooter }) — facade เรียก finalize() ให้เอง
 */
import { createKapomReport, createAnchoredBand } from '../src/index';
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
  pageHeader: createAnchoredBand({
    height: 16,
    anchors: [
      { align: 'left', format: 'Kapom Report — Demo', style: { fontStyle: 'bold', color: [41, 128, 185] } },
      { align: 'right', format: '{date}', style: { color: [41, 128, 185] } },
    ],
  }),
  // เทียบกับ 05-page-header-footer ที่เขียน render callback มือเอง — ที่นี่ format
  // string ล้วนๆ ผ่าน {pageNumber}/{totalPages}/{dateTime} ไม่ต้องแตะ doc.setFontSize/setTextColor เอง
  pageFooter: createAnchoredBand({
    height: 12,
    anchors: [
      { align: 'left', format: 'สร้างโดย kapom-report — {dateTime}', style: { color: [120, 120, 120] } },
      { align: 'right', format: 'หน้า {pageNumber} จาก {totalPages}', style: { color: [120, 120, 120] } },
    ],
    dateFormat: { locale: 'th-TH', dateStyle: 'medium', timeStyle: 'short' },
  }),
  blocks: [
    bigTable,
    { type: 'spacer', height: 6 },
    {
      type: 'text',
      content: 'header/footer ประกอบจาก createAnchoredBand() — ไม่ต้องเขียน render callback มือเอง',
      style: { fontSize: 10, fontStyle: 'bold' },
    },
  ],
});

saveReport(report, '09-system-field-anchor');
