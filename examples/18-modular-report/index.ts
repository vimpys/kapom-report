/**
 * File 3 of 3 — the runner.
 * Wires the two independent pieces together: raw rows from data.ts + the reusable template from
 * report-template.ts, then saves the PDF. This is the only file that knows about both — swapping
 * the data source or reusing the template for another company touches nothing else.
 *
 * Run with: `tsx examples/18-modular-report/index.ts`
 */
import { saveReport } from '../shared';
import { sales } from './data';
import { buildSalesReport } from './report-template';

const report = buildSalesReport(sales, {
  companyName: 'Kapom Company',
  reportTitle: 'Sales Report',
  reportDescription: 'Quarterly sales by product and customer — FY2026',
});

saveReport(report, '18-modular-report');
