/**
 * File 4 of 4 — the runner.
 * Wires the two datasets (data.ts) into the composite template (report-template.ts) and saves.
 * This is the only file that knows about both the data and the presentation options.
 *
 * Run with: `tsx examples/13-composite-report/index.ts`
 */
import { outPath } from '../shared';
import { expenses, sales } from './data';
import { buildCompanyReport } from './report-template';

const report = buildCompanyReport(sales, expenses, {
  companyName: 'Kapom Riverside Hotel',
  period: 'July 2026',
  reportTitle: 'Financial Report',
  reportDescription: 'Monthly sales & expenses — FY2026',
});

report.save(outPath('13-composite-report'));
console.log(`OK 13-composite-report.pdf (${report.doc.getNumberOfPages()} pages)`);
