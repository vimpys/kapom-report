/**
 * File 3 of 3 — the runner.
 * Wires the raw branch sales (data.ts) into the nested-group template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/06-nested-group/index.ts`
 */
import { saveReport } from '../shared';
import { branchSales } from './data';
import { buildBranchSales } from './report-template';

const report = buildBranchSales(branchSales);

saveReport(report, '06-nested-group');
