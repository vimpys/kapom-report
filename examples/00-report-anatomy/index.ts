/**
 * File 3 of 3 — the runner.
 * Renders the anatomy report and saves it. Open the PDF next to README.md in this folder: the
 * document demonstrates each region the map describes.
 *
 * Run with: `tsx examples/00-report-anatomy/index.ts`
 */
import { outPath } from '../shared';
import { buildReportAnatomy } from './report-template';

const report = buildReportAnatomy();

report.save(outPath('00-report-anatomy'));
console.log(`OK 00-report-anatomy.pdf (${report.doc.getNumberOfPages()} pages)`);
