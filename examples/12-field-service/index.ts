/**
 * File 3 of 3 — the runner.
 * Wires the completed service call (data.ts) into the form template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/12-field-service/index.ts`
 */
import { outPath } from '../shared';
import { serviceReport } from './data';
import { buildFieldServiceReport } from './report-template';

const report = buildFieldServiceReport(serviceReport);

report.save(outPath('12-field-service'));
console.log(`OK 12-field-service.pdf (${report.doc.getNumberOfPages()} pages)`);
