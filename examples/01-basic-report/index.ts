/**
 * File 3 of 3 — the runner.
 * Wires the raw sales (data.ts) into the template (report-template.ts), then shows the two
 * output paths of a KapomReport:
 *   1. save(filename) — writes a permanent PDF (outPath() just builds examples/output/<name>.pdf)
 *   2. preview() — writes a temp file and opens the OS's default PDF viewer immediately
 *      (on the browser, use report.doc.output('dataurlnewwindow') from jsPDF directly instead)
 *
 * Run with: `tsx examples/01-basic-report/index.ts`
 */
import { outPath } from '../shared';
import { sales } from './data';
import { buildDailySales } from './report-template';

const report = buildDailySales(sales);

// path 1: save to a permanent file (examples/output, same as every other demo)
report.save(outPath('01-basic-report'));
console.log(`OK 01-basic-report.pdf (${report.doc.getNumberOfPages()} pages)`);

// path 2: preview — writes a temp file + opens the OS's own viewer (returns the path in case
// you want to delete/reference it); note: this is why `npm run demo` pops one viewer window
const previewPath = report.preview();
console.log(`Opening preview: ${previewPath}`);
