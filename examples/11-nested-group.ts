/**
 * Demo — nested group (roadmap 10)
 * โฟกัส: group ซ้อน 2 ระดับ (region → category) ผ่าน GroupResolver.subGroup —
 * band ทุกระดับ (label ระดับใน indent), subtotal ต่อ sub-group (foot ของ segment),
 * subtotal ต่อ region (แถวเดี่ยวพื้นเทาจับคู่ band) และ grand total ปิดท้าย;
 * เทียบกับ 03-grouped-report.ts ที่ group ระดับเดียว
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface RegionSale {
  region: string;
  category: string;
  product: string;
  qty: number;
  price: string;
}

const regions = ['เหนือ', 'ใต้', 'ตะวันออก'];
const categories = ['อาหาร', 'เครื่องดื่ม'];

const sales: RegionSale[] = regions.flatMap((region, r) =>
  categories.flatMap((category, c) =>
    Array.from({ length: 5 }, (_, i) => ({
      region,
      category,
      product: `สินค้า ${r * 10 + c * 5 + i + 1}`,
      qty: (i % 4) + 1,
      price: `${(i % 50) + 20}.50`,
    })),
  ),
);

const nestedTable: TableNode<RegionSale> = {
  type: 'table',
  columns: [
    // ไม่มี rowNumber นำหน้า — subtotal label ลง cell แรกที่ว่าง (คอลัมน์แรก) ถ้าเป็นคอลัมน์แคบ label ยาวจะ wrap
    { type: 'data', key: 'product', header: 'สินค้า' },
    { type: 'data', key: 'qty', header: 'จำนวน', align: 'right', aggregate: 'sum' },
    { type: 'data', key: 'price', header: 'ราคา', align: 'right', numberFormat: {}, aggregate: 'sum' },
  ],
  data: sales,
  summaryLabel: 'รวมทั้งหมด',
  group: {
    by: 'region',
    headerLabel: (key) => `ภูมิภาค${key}`,
    footerLabel: (key) => `รวมภูมิภาค${key}`,
    keepTogether: { minRowsWithHeader: 2 },
    subGroup: {
      by: 'category',
      footerLabel: (key) => `รวม${key}`,
    },
  },
};

const report = createKapomReport<RegionSale>({
  font: fontConfig,
  blocks: [
    {
      type: 'text',
      content: 'Nested group — region → category ซ้อน 2 ระดับ',
      style: { fontSize: 14, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 4 },
    nestedTable,
  ],
});

saveReport(report, '11-nested-group');
