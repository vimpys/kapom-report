/**
 * File 3 of 3 — the runner.
 * Wires the raw quotation (data.ts) into the reusable template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/16-quotation/index.ts`
 */
import { saveReport } from '../shared';
import { quotation } from './data';
import { buildQuotation } from './report-template';

const report = buildQuotation(quotation);

saveReport(report, '16-quotation');
