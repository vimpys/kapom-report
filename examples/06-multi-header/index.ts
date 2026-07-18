/**
 * File 3 of 3 — the runner.
 * Wires the monthly sales (data.ts) into the multi-header template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/06-multi-header/index.ts`
 */
import { outPath } from '../shared';
import { sales } from './data';
import { buildQuarterlySales } from './report-template';

const report = buildQuarterlySales(sales);

report.save(outPath('06-multi-header'));
console.log(`OK 06-multi-header.pdf (${report.doc.getNumberOfPages()} pages)`);
