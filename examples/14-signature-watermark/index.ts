/**
 * File 3 of 3 — the runner.
 * Wires the sales rows (data.ts) into the template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/14-signature-watermark/index.ts`
 */
import { outPath } from '../shared';
import { sales } from './data';
import { buildSignatureReport } from './report-template';

const report = buildSignatureReport(sales);

report.save(outPath('14-signature-watermark'));
console.log(`OK 14-signature-watermark.pdf (${report.doc.getNumberOfPages()} pages)`);
