/**
 * Demo — Report Header + Section/Stack composite (roadmap 6b)
 * โฟกัส: TextNode.role ใช้ Typography token (reportTitle/reportSubtitle/sectionHeading)
 * เป็น base style + { type: 'section' }/{ type: 'stack' } render children ตามลำดับ
 * (measureHeight รวมแบบ recursive, per-child ensureSpace กันลูกตกขอบหน้า)
 * เรียกผ่าน createKapomReport({ blocks }) — ไม่ต้องแตะ jsPDF/RenderEngine เอง
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 10 }, (_, i) => ({
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

// report header = stack ของ text ที่ใช้ Typography token ตรง role (ไม่ต้องตั้ง style เอง)
const report = createKapomReport<Sale>({
  font: fontConfig,
  blocks: [
    {
      type: 'stack',
      children: [
        { type: 'text', content: 'Monthly Sales Report', role: 'reportTitle' },
        { type: 'text', content: 'January 2026 — All Regions', role: 'reportSubtitle' },
      ],
    },
    { type: 'spacer', height: 6 },
    // section = stack + name (name ใช้กับ Report Registry เลือก section — ดู demo 07)
    {
      type: 'section',
      name: 'sales-summary',
      children: [
        { type: 'text', content: 'Sales Summary', role: 'sectionHeading' },
        { type: 'spacer', height: 3 },
        salesTable,
      ],
    },
  ],
});

saveReport(report, '06-report-header-section');
