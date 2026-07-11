/**
 * File 2 of 3 — the report template.
 * Data-agnostic: everything about how the report *looks* lives here (columns, currency
 * formatting, the repeating header band with logo + report metadata + a standing note, zebra
 * striping, page numbers), exposed as a single `buildSalesReport(sales, options)` function.
 * Swap in any `Sale[]` — or different company/report metadata — and get the same formatted,
 * paginated report. The data itself lives in data.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKapomReport } from '../../src/index';
import type { KapomReport, PageBand, RGB, TableNode } from '../../src/index';
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

function formatPrintedAt(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** header band drawn on every page: logo + company (left), report metadata (right), a divider, then the standing note */
function buildHeaderBand(options: SalesReportOptions, printedAt: string): PageBand {
  const title = options.reportTitle ?? 'Sales Report';
  const description = options.reportDescription ?? 'Quarterly sales by product and customer';

  return {
    height: 34,
    render: ({ doc, x, y, width, drawText }): void => {
      const right = x + width;
      const setText = (size: number, style: 'normal' | 'bold', color: RGB): void => {
        doc.setFont('Sarabun', style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
      };
      const rightText = (text: string, baseline: number): void =>
        drawText(text, right - doc.getTextWidth(text), baseline);

      // left: logo + company name + tagline
      doc.addImage(logo, 'PNG', x, y, 13, 13);
      setText(13, 'bold', NAVY);
      drawText(options.companyName, x + 16, y + 6);
      setText(8, 'normal', GRAY);
      drawText('kapom-soft', x + 16, y + 10.5);

      // right: report title / description / print timestamp
      setText(16, 'bold', NAVY);
      rightText(title, y + 5.5);
      setText(8.5, 'normal', GRAY);
      rightText(description, y + 10);
      setText(8, 'normal', GRAY);
      rightText(`Printed: ${printedAt}`, y + 14);

      // divider between the metadata row and the note
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
      doc.setLineWidth(0.2);
      doc.line(x, y + 17, right, y + 17);

      // standing note — wrapped to the band width, drawn line by line
      setText(8, 'normal', GRAY);
      const split: unknown = doc.splitTextToSize(STANDING_NOTE, width);
      const noteLines = Array.isArray(split) ? (split as string[]) : [STANDING_NOTE];
      noteLines.forEach((line, i) => drawText(line, x, y + 21 + i * 3.8));
    },
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

  return createKapomReport<Sale>({
    font: fontConfig,
    pageHeader: buildHeaderBand(options, formatPrintedAt(new Date())),
    pageNumber: { position: 'bottom-center', format: 'Page {pageNumber} of {totalPages}' },
    blocks: [salesTable],
  });
}
