/**
 * File 3 of 3 — the runner.
 * Wires the stock list (data.ts) into the framed template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/11-page-frame/index.ts`
 */
import { outPath } from '../shared';
import { stock } from './data';
import { buildInventoryReport } from './report-template';

const report = buildInventoryReport(stock);

report.save(outPath('11-page-frame'));
console.log(`OK 11-page-frame.pdf (${report.doc.getNumberOfPages()} pages)`);
