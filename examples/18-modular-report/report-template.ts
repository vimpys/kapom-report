/**
 * File 2 of 3 — the report template.
 * Data-agnostic: everything about how the report *looks* lives here (columns, currency
 * formatting, the repeating header band with logo + report metadata + a standing note, zebra
 * striping, page numbers), exposed as a single `buildSalesReport(sales, options)` function.
 * Swap in any `Sale[]` — or different company/report metadata — and get the same formatted,
 * paginated report. The data itself lives in data.ts.
 *
 * Built with the `reportBuilder()` chain, section names following the report anatomy. The page
 * header is a sub-builder: `report.pageHeader.addBlock(...)` — blocks are ordinary (row / image /
 * text / divider, no raw jsPDF), and the band's reserved height is auto-measured from them (no
 * magic number). `content` is the flowing body. Either style — chain or `createKapomReport({...})`
 * object — produces an identical report.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatTimestamp, reportBuilder } from '../../src/index';
import type { ColumnGroup, KapomReport, ReportColumn, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const ZEBRA: RGB = [240, 244, 249];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the standing note reprinted at the top of every page (grammar-checked, deliberately a bit long) */
const STANDING_NOTE =
  'Note: The figures shown in this report are sample data generated for demonstration purposes only. They do not represent the actual sales, customers, or financial performance of any real organization, and must not be used for accounting, forecasting, or decision-making.';

type MonthKey =
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec';

/** plain integer with a thousands separator (dash for zero) — used for the month + total columns */
const compact = (n: number): string => (n > 0 ? n.toLocaleString('en-US') : '-');

// no explicit width — AutoTable auto-sizes the 12 month columns to fill the remaining page width
const month = (key: MonthKey, header: string): ReportColumn<Sale> => ({
  type: 'data',
  key,
  header,
  align: 'right',
  formatter: (value) => compact(Number(value)),
});

/** a quarter = a column group over its three months */
const quarter = (header: string, m1: MonthKey, m2: MonthKey, m3: MonthKey): ColumnGroup<Sale> => ({
  type: 'group',
  header,
  columns: [month(m1, capitalize(m1)), month(m2, capitalize(m2)), month(m3, capitalize(m3))],
});

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const MONTH_KEYS: readonly MonthKey[] = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface SalesReportOptions {
  companyName: string;
  /** the report's name, shown top-right — default 'Sales Report' */
  reportTitle?: string;
  /** one-line description under the report name */
  reportDescription?: string;
}

/** the brand row of the header band: logo + company (left), report metadata (right) */
function brandRow(options: SalesReportOptions, printedAt: string): ReportNodeInput {
  const title = options.reportTitle ?? 'Sales Report';
  const description = options.reportDescription ?? 'Quarterly sales by product and customer';
  return {
    type: 'row',
    columns: [
      { width: 14, children: [{ type: 'image', data: logo, format: 'PNG', width: 14, height: 14 }] },
      {
        children: [
          { type: 'spacer', height: 2 },
          { content: options.companyName, style: { fontSize: 13, fontStyle: 'bold', color: NAVY } },
          { content: 'kapom-soft', style: { fontSize: 8, color: GRAY } },
        ],
      },
      {
        children: [
          { content: title, align: 'right', style: { fontSize: 16, fontStyle: 'bold', color: NAVY } },
          { content: description, align: 'right', style: { fontSize: 8.5, color: GRAY } },
          { content: `Printed: ${printedAt}`, align: 'right', style: { fontSize: 8, color: GRAY } },
        ],
      },
    ],
  };
}

/** compose a paginated, formatted sales report from raw rows + presentation options */
export function buildSalesReport(sales: Sale[], options: SalesReportOptions): KapomReport {
  const salesTable: TableNode<Sale> = {
    type: 'table',
    columns: [
      // header align is centered by default now — no need to set headerAlign per column
      { type: 'data', key: 'product', header: 'Product', width: 30 },
      { type: 'data', key: 'customer', header: 'Customer', width: 22 },
      // 3-level header: Quarterly → Qtr 1-4 → the three months of each quarter
      {
        type: 'group',
        header: 'Quarterly',
        columns: [
          quarter('Qtr 1', 'jan', 'feb', 'mar'),
          quarter('Qtr 2', 'apr', 'may', 'jun'),
          quarter('Qtr 3', 'jul', 'aug', 'sep'),
          quarter('Qtr 4', 'oct', 'nov', 'dec'),
        ],
      },
      {
        type: 'computed',
        header: 'Total',
        align: 'right',
        width: 22,
        compute: (row) => MONTH_KEYS.reduce((sum, key) => sum + row[key], 0),
        formatter: (value) => compact(Number(value)),
        cellStyle: { fontStyle: 'bold' },
      },
    ],
    data: sales,
    style: { header: { fillColor: NAVY }, zebra: { even: ZEBRA } },
  };

  // landscape + tighter margins — 12 month columns need the wider content area
  const report = reportBuilder<Sale>()
    .font(fontConfig)
    .pageSetup({ orientation: 'landscape', margins: { top: 12, bottom: 12, left: 10, right: 10 } });

  // page header band, built block by block — its reserved height is auto-measured (no magic number)
  report.pageHeader
    .addBlock(brandRow(options, formatTimestamp(new Date())))
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ content: STANDING_NOTE, style: { fontSize: 8, color: GRAY } })
    .addBlock({ type: 'spacer', height: 2 }); // small gap before the table

  report.pageNumber({ position: 'bottom-center', format: 'Page {pageNumber} of {totalPages}' });
  report.content(salesTable);

  return report.build();
}
