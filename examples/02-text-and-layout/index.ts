/**
 * File 3 of 3 — the runner.
 * Wires the page content (data.ts) into the layout template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/02-text-and-layout/index.ts`
 */
import { outPath } from '../shared';
import { article } from './data';
import { buildTextAndLayout } from './report-template';

const report = buildTextAndLayout(article);

report.save(outPath('02-text-and-layout'));
console.log(`OK 02-text-and-layout.pdf (${report.doc.getNumberOfPages()} pages)`);
