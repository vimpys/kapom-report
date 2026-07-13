/**
 * File 3 of 3 — the runner.
 * Wires the raw order lines (data.ts) into the template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/04-aggregate-columns/index.ts`
 */
import { saveReport } from '../shared';
import { orderLines } from './data';
import { buildOrderSummary } from './report-template';

const report = buildOrderSummary(orderLines);

saveReport(report, '04-aggregate-columns');
