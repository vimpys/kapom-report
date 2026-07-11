/**
 * File 3 of 3 — the runner.
 * Wires the completed service call (data.ts) into the form template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/17-field-service/index.ts`
 */
import { saveReport } from '../shared';
import { serviceReport } from './data';
import { buildFieldServiceReport } from './report-template';

const report = buildFieldServiceReport(serviceReport);

saveReport(report, '17-field-service');
