/**
 * File 3 of 4 — the report template.
 * Demo — Composite report: a full business document assembled from named sections.
 * Focus:
 *   ReportRegistry — registry.build(order, context) composes heterogeneous sections (sales +
 *                    expenses) and injects the same shared context into every builder (see sections.ts)
 *   page frame     — a repeating pageHeader band (logo + company + report metadata + a standing
 *                    note, auto-measured height) + page numbers that don't eat the content area
 *   breakBefore    — the expenses section starts on a fresh page (policy lives in the section)
 *
 * Built with reportBuilder() — the sections from the registry are spread straight into .content().
 * (createKapomReport({ blocks }) is the lower-level object form, shown in the final advanced demo.)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatTimestamp, reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB } from '../../src/index';
import { fontConfig } from '../shared';
import { buildSectionRegistry, type CompanyReportContext } from './sections';
import type { Expense, Sale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the standing note reprinted at the top of every page */
const STANDING_NOTE =
  'Note: The figures shown in this report are sample data generated for demonstration purposes only. ' +
  'They do not represent the actual performance of any real organization.';

export interface CompanyReportOptions extends CompanyReportContext {
  reportTitle?: string;
  reportDescription?: string;
}

/** the brand row of the header band: logo + company (left), report metadata (right) */
function brandRow(options: CompanyReportOptions, printedAt: string): ReportNodeInput {
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
          { content: options.reportTitle ?? 'Financial Report', align: 'right', style: { fontSize: 16, fontStyle: 'bold', color: NAVY } },
          { content: options.reportDescription ?? options.period, align: 'right', style: { fontSize: 8.5, color: GRAY } },
          { content: `Printed: ${printedAt}`, align: 'right', style: { fontSize: 8, color: GRAY } },
        ],
      },
    ],
  };
}

/** compose the full composite report from raw datasets + presentation options */
export function buildCompanyReport(sales: Sale[], expenses: Expense[], options: CompanyReportOptions): KapomReport {
  const registry = buildSectionRegistry(sales, expenses);

  const report = reportBuilder().font(fontConfig);

  // page header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandRow(options, formatTimestamp(new Date())))
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ content: STANDING_NOTE, style: { fontSize: 8, color: GRAY } })
    .addBlock({ type: 'spacer', height: 2 });

  report.pageNumber({ position: 'bottom-center', format: 'Page {pageNumber} of {totalPages}' });

  // the registry composes the sections in order + injects the shared context into each
  report.content(
    ...registry.build(['sales', 'expenses'], { companyName: options.companyName, period: options.period }),
  );

  return report.build();
}
