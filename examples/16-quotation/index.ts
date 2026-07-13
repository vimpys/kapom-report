/**
 * File 3 of 3 — the runner.
 * Wires the raw quotation (data.ts) into the reusable template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/16-quotation/index.ts`
 */
import { outPath } from '../shared';
import { quotation } from './data';
import { buildQuotation } from './report-template';

const report = buildQuotation(quotation);

report.save(outPath('16-quotation'));
console.log(`OK 16-quotation.pdf (${report.doc.getNumberOfPages()} pages)`);
