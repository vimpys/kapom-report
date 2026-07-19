/**
 * File 3 of 3 — the runner.
 * Wires the raw regional sales (data.ts) into the grouped template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/04-group-report/index.ts`
 */
import { outPath } from '../shared';
import { regionSales } from './data';
import { buildRegionalSales } from './report-template';

const report = buildRegionalSales(regionSales);

report.save(outPath('04-group-report'));
console.log(`OK 04-group-report.pdf (${report.doc.getNumberOfPages()} pages)`);
