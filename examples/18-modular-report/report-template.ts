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
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
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

/** "$1,170.00" for a positive amount, an accounting dash for zero */
const money = (n: number): string =>
  n > 0 ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

const quarter = (key: 'q1' | 'q2' | 'q3' | 'q4', header: string): TableNode<Sale>['columns'][number] => ({
  type: 'data',
  key,
  header,
  align: 'right',
  width: 24,
  formatter: (value) => money(Number(value)),
});

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
      { type: 'data', key: 'product', header: 'Product', width: 34 },
      { type: 'data', key: 'customer', header: 'Customer', width: 24 },
      quarter('q1', 'Qtr 1'),
      quarter('q2', 'Qtr 2'),
      quarter('q3', 'Qtr 3'),
      quarter('q4', 'Qtr 4'),
      {
        type: 'computed',
        header: 'Total',
        align: 'right',
        width: 26,
        compute: (row) => row.q1 + row.q2 + row.q3 + row.q4,
        formatter: (value) => money(Number(value)),
        cellStyle: { fontStyle: 'bold' },
      },
    ],
    data: sales,
    style: { header: { fillColor: NAVY }, zebra: { even: ZEBRA } },
  };

  const report = reportBuilder<Sale>().font(fontConfig);

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
