/**
 * File 3 of 3 — the runner.
 * Wires the page content (data.ts) into the layout template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/02-text-and-layout/index.ts`
 */
import { saveReport } from '../shared';
import { article } from './data';
import { buildTextAndLayout } from './report-template';

const report = buildTextAndLayout(article);

saveReport(report, '02-text-and-layout');
