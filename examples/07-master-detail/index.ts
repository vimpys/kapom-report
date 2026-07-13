/**
 * File 3 of 3 — the runner.
 * Wires the payment batches (data.ts) into the master-detail template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/07-master-detail/index.ts`
 */
import { outPath } from '../shared';
import { batches } from './data';
import { buildBatchReport } from './report-template';

const report = buildBatchReport(batches);

report.save(outPath('07-master-detail'));
console.log(`OK 07-master-detail.pdf (${report.doc.getNumberOfPages()} pages)`);
