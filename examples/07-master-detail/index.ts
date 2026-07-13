/**
 * File 3 of 3 — the runner.
 * Wires the payment batches (data.ts) into the master-detail template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/07-master-detail/index.ts`
 */
import { saveReport } from '../shared';
import { batches } from './data';
import { buildBatchReport } from './report-template';

const report = buildBatchReport(batches);

saveReport(report, '07-master-detail');
