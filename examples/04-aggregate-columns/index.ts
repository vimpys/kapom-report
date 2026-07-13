/**
 * File 3 of 3 — the runner.
 * Wires the raw order lines (data.ts) into the template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/04-aggregate-columns/index.ts`
 */
import { outPath } from '../shared';
import { orderLines } from './data';
import { buildOrderSummary } from './report-template';

const report = buildOrderSummary(orderLines);

report.save(outPath('04-aggregate-columns'));
console.log(`OK 04-aggregate-columns.pdf (${report.doc.getNumberOfPages()} pages)`);
