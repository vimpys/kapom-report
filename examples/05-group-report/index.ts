/**
 * File 3 of 3 — the runner.
 * Wires the raw regional sales (data.ts) into the grouped template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/05-group-report/index.ts`
 */
import { saveReport } from '../shared';
import { regionSales } from './data';
import { buildRegionalSales } from './report-template';

const report = buildRegionalSales(regionSales);

saveReport(report, '05-group-report');
