/**
 * File 3 of 3 — the runner.
 * Wires the monthly sales (data.ts) into the multi-header template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/08-multi-header/index.ts`
 */
import { saveReport } from '../shared';
import { sales } from './data';
import { buildQuarterlySales } from './report-template';

const report = buildQuarterlySales(sales);

saveReport(report, '08-multi-header');
