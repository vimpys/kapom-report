/**
 * Demo — createKapomReport facade (roadmap 8)
 * โฟกัส: public API จริงที่ user จะใช้ — ไม่ต้อง new jsPDF()/RenderEngine/createBlock ตรงเหมือน
 * demo 01-09; column shorthand ({ key, header } ไม่ใส่ type) + group shorthand (string key)
 * + title → แปลงเป็น ReportNode tree เดียวกันหลังบ้านผ่าน resolveReportConfig()
 * + document: { orientation, format } ส่งตรงเข้า new jsPDF() — letter/landscape แทน default a4/portrait
 */
import { createKapomReport } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  category: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 20 }, (_, i) => ({
  product: `Product ${i + 1}`,
  category: i % 2 === 0 ? 'Food' : 'Drink',
  qty: (i % 5) + 1,
}));

const report = createKapomReport({
  title: 'Monthly Sales Report',
  font: fontConfig,
  document: { orientation: 'landscape', format: 'letter' }, // ไม่ระบุ = default a4/portrait ของ jsPDF เอง
  group: 'category', // ชั้น 2 shorthand — เทียบกับ examples/03-grouped-report.ts ที่ต้องเขียน GroupResolver เต็มรูปเอง
  columns: [
    // ชั้น 1 shorthand — ไม่ใส่ type เลย normalize เป็น DataColumn ให้เอง
    { key: 'product', header: 'Product' },
    { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
});

saveReport(report, '10-facade');
