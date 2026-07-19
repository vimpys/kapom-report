/**
 * File 3 of 3 — the runner.
 * Wires the orders (data.ts) into the advanced template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/13-advance-report/index.ts`
 */
import { outPath } from '../shared';
import { orders } from './data';
import { buildAdvanceReport } from './report-template';

const report = buildAdvanceReport(orders);

report.save(outPath('13-advance-report'));
console.log(`OK 13-advance-report.pdf (${report.doc.getNumberOfPages()} pages)`);
