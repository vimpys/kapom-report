/**
 * Demo — pageNumber: a lightweight page-number annotation (distinct from pageHeader/pageFooter)
 * Focus: unlike pageHeader/pageFooter (PageBand), pageNumber never reserves content-area space —
 * it draws directly inside the existing page margin (which content never uses anyway), at a
 * fixed position on every page. Content here uses almost the full page height, same as if there
 * were no page number at all — compare with 05-page-header-footer.ts, where pageFooter's
 * reserved band visibly shrinks the content area on every page.
 * Uses createKapomReport({ blocks, pageNumber }) — no pageHeader/pageFooter needed for this alone
 */
import { createKapomReport } from '../src/index';
import { fontConfig, saveReport } from './shared';

const report = createKapomReport({
  font: fontConfig,
  pageNumber: 'bottom-right', // layer 2 shorthand — layer 1 would just be `pageNumber: true` (default 'bottom-left')
  blocks: [
    { content: 'pageNumber demo — bottom-right, inside the margin', style: { fontSize: 14, fontStyle: 'bold' } },
    { type: 'spacer', height: 4 },
    { type: 'divider', thickness: 1, color: [200, 0, 0] },
    { type: 'spacer', height: 4 },
    {
      content: 'Testing: content uses almost the full page — the page number below lives in the margin, not a reserved band',
      style: { fontStyle: 'bold' },
    },
    ...Array.from(
      { length: 100 },
      (_, i) => `Test line ${i + 1} — RenderEngine starts a new page on its own when space runs out`,
    ),
  ],
});

saveReport(report, '14-page-number');
