/**
 * Demo — save + preview
 * โฟกัส: report เดียว output ได้ 2 ทาง — save(filename) เขียนไฟล์ถาวร
 * และ preview() เขียน temp file แล้วเปิดด้วย PDF viewer default ของ OS ทันที
 * (ฝั่ง browser ใช้ report.doc.output('dataurlnewwindow') ของ jsPDF ตรงๆ แทน)
 */
import { createKapomReport } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 8 }, (_, i) => ({
  product: `สินค้า ${i + 1}`,
  qty: (i % 5) + 1,
}));

const report = createKapomReport({
  title: 'Save & Preview Demo',
  font: fontConfig,
  columns: [
    { key: 'product', header: 'สินค้า' },
    { key: 'qty', header: 'จำนวน', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
});

// ทาง 1: save ลงไฟล์ถาวร (examples/output เหมือน demo อื่น)
saveReport(report, '12-save-preview');

// ทาง 2: preview — เขียน temp file + เปิด viewer ของ OS เอง (คืน path เผื่ออยากลบ/อ้างอิงต่อ)
const previewPath = report.preview();
console.log(`👀 เปิด preview: ${previewPath}`);
