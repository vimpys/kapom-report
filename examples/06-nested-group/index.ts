/**
 * File 3 of 3 — the runner.
 * Wires the raw branch sales (data.ts) into the nested-group template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/06-nested-group/index.ts`
 */
import { outPath } from '../shared';
import { branchSales } from './data';
import { buildBranchSales } from './report-template';

const report = buildBranchSales(branchSales);

report.save(outPath('06-nested-group'));
console.log(`OK 06-nested-group.pdf (${report.doc.getNumberOfPages()} pages)`);
