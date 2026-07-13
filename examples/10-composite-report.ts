/**
 * Demo — Composite Report via ReportRegistry (roadmap 6c)
 * Focus: composing multiple sections by name + the same shared context (hotelName/month)
 * across every builder + breakBefore forcing a new page before the expenses section
 * (a page-break policy between sections)
 * Uses createKapomReport({ blocks: registry.build(...) }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport, ReportRegistry } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, outPath } from './shared';

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

// breakBefore: true — expenses always starts on a new page, no need to rely on ensureSpace guessing
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

report.save(outPath('10-composite-report'));
console.log(`OK 10-composite-report.pdf (${report.doc.getNumberOfPages()} pages)`);
