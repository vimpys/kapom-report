/**
 * File 2 of 4 — the section builders (ReportRegistry).
 * Each section is registered by name; ReportRegistry.build(order, context) composes them in the
 * given order and injects the *same* shared context (companyName / period) into every builder.
 * The two sections have different row shapes (Sale vs Expense) — the registry keeps them as
 * separate, self-contained pieces. `breakBefore` on the expenses section forces a fresh page.
 */
import { ReportRegistry } from '../../src/index';
import type { SectionNode, TableNode } from '../../src/index';
import type { Expense, Sale } from './data';

/** shared context injected into every section builder at build() time */
export interface CompanyReportContext {
  companyName: string;
  period: string;
}

function salesTable(sales: Sale[]): TableNode<Sale> {
  return {
    type: 'table',
    columns: [
      // `type: 'data'` is the default — omit it
      { key: 'product', header: 'Product' },
      { key: 'customer', header: 'Customer' },
      // aggregate uses `numberFormat` (not `formatter`), so the grand total matches the rows
      { key: 'amount', header: 'Amount', align: 'right', aggregate: 'sum', numberFormat: { fractionDigits: 2 } },
    ],
    data: sales,
    summaryLabel: 'Total Sales',
  };
}

function expensesTable(expenses: Expense[]): TableNode<Expense> {
  return {
    type: 'table',
    columns: [
      { key: 'category', header: 'Category' },
      { key: 'vendor', header: 'Vendor' },
      { key: 'amount', header: 'Amount', align: 'right', aggregate: 'sum', numberFormat: { fractionDigits: 2 } },
    ],
    data: expenses,
    summaryLabel: 'Total Expenses',
  };
}

/** a registry with both sections registered by name — assembled in report-template.ts */
export function buildSectionRegistry(sales: Sale[], expenses: Expense[]): ReportRegistry<CompanyReportContext> {
  const registry = new ReportRegistry<CompanyReportContext>();

  registry.register('sales', (ctx): SectionNode<Sale> => ({
    type: 'section',
    name: 'sales',
    children: [
      { content: `Sales — ${ctx.period}`, role: 'sectionHeading' },
      { type: 'spacer', height: 3 },
      salesTable(sales),
    ],
  }));

  // breakBefore: true — expenses always starts on a new page (a page-break policy between sections)
  registry.register('expenses', (ctx): SectionNode<Expense> => ({
    type: 'section',
    name: 'expenses',
    breakBefore: true,
    children: [
      { content: `Expenses — ${ctx.period}`, role: 'sectionHeading' },
      { type: 'spacer', height: 3 },
      expensesTable(expenses),
    ],
  }));

  return registry;
}
