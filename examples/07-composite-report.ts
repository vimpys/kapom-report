/**
 * Demo — Composite Report ผ่าน ReportRegistry (roadmap 6c)
 * โฟกัส: ประกอบหลาย section ด้วยชื่อ + shared context (hotelName/month) เดียวกันทุก builder
 * + breakBefore บังคับขึ้นหน้าใหม่ก่อน section รายจ่าย (page-break policy ระหว่าง section)
 * เรียกผ่าน createKapomReport({ blocks: registry.build(...) }) — ไม่ต้องแตะ jsPDF/RenderEngine เอง
 */
import { createKapomReport, ReportRegistry } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  amount: number;
}

interface Expense {
  category: string;
  amount: number;
}

interface HotelReportContext {
  hotelName: string;
  month: string;
}

const sales: Sale[] = [
  { product: 'Room Booking', amount: 152000 },
  { product: 'Restaurant', amount: 48500 },
  { product: 'Spa', amount: 21300 },
];

const expenses: Expense[] = [
  { category: 'Staff Wages', amount: 65000 },
  { category: 'Utilities', amount: 18200 },
  { category: 'Maintenance', amount: 9400 },
];

const registry = new ReportRegistry<HotelReportContext>();

registry.register('report-header', (ctx) => ({
  type: 'section',
  name: 'report-header',
  children: [
    { type: 'text', content: ctx.hotelName, role: 'reportTitle' },
    { type: 'text', content: `Monthly Report — ${ctx.month}`, role: 'reportSubtitle' },
  ],
}));

registry.register('sales-section', () => {
  const salesTable: TableNode<Sale> = {
    type: 'table',
    columns: [
      { type: 'data', key: 'product', header: 'Product' },
      {
        type: 'data',
        key: 'amount',
        header: 'Amount',
        align: 'right',
        aggregate: 'sum',
      },
    ],
    data: sales,
  };
  return {
    type: 'section',
    name: 'sales-section',
    children: [
      { type: 'text', content: 'Sales', role: 'sectionHeading' },
      { type: 'spacer', height: 3 },
      salesTable,
    ],
  };
});

// breakBefore: true — รายจ่ายขึ้นหน้าใหม่เสมอ ไม่ต้องพึ่ง ensureSpace เดาเอง
registry.register('expenses-section', () => {
  const expensesTable: TableNode<Expense> = {
    type: 'table',
    columns: [
      { type: 'data', key: 'category', header: 'Category' },
      {
        type: 'data',
        key: 'amount',
        header: 'Amount',
        align: 'right',
        aggregate: 'sum',
      },
    ],
    data: expenses,
  };
  return {
    type: 'section',
    name: 'expenses-section',
    breakBefore: true,
    children: [
      { type: 'text', content: 'Expenses', role: 'sectionHeading' },
      { type: 'spacer', height: 3 },
      expensesTable,
    ],
  };
});

const report = createKapomReport({
  font: fontConfig,
  blocks: registry.build(
    ['report-header', 'sales-section', 'expenses-section'],
    { hotelName: 'Kapom Riverside Hotel', month: 'July 2026' },
  ),
});

saveReport(report, '07-composite-report');
