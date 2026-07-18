/**
 * File 3 of 3 — the runner.
 * Wires the raw quotation (data.ts) into the reusable template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/10-quotation/index.ts`
 */
import { outPath } from '../shared';
import { quotation } from './data';
import { buildQuotation } from './report-template';

const report = buildQuotation(quotation);

report.save(outPath('10-quotation'));
console.log(`OK 10-quotation.pdf (${report.doc.getNumberOfPages()} pages)`);
