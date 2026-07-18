/**
 * File 2 of 3 — the anatomy report itself.
 * A self-referential demo: it renders the anatomy map (data.ts) as a report that *uses every region
 * it describes*. Read the generated PDF alongside the labels and you can see each reportBuilder()
 * method producing exactly the region it names. Built to run onto a second page so the once-vs-every-
 * page behaviour is visible (title/summary appear once; header/footer/number reprint).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportBuilder, spacer } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import { anatomy, detail } from './data';
import type { AnatomyRow } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** TableNode is invariant in T — this one cast lets the AnatomyRow table sit in an unknown flow (see demo 01) */
const untyped = <T>(t: TableNode<T>): TableNode<unknown> => t as unknown as TableNode<unknown>;

/** page header band — logo + company; its own label marks it as the frame layer */
const brandHeader: ReportNodeInput = {
  type: 'row',
  columns: [
    { width: 14, children: [{ type: 'image', data: logo, format: 'PNG', width: 14, height: 14 }] },
    {
      children: [
        { type: 'spacer', height: 2 },
        { content: 'Kapom Company', style: { fontSize: 13, fontStyle: 'bold', color: NAVY } },
        { content: 'page header — .pageHeader.addBlock() — frame, repeats every page', style: { fontSize: 7.5, color: GRAY } },
      ],
    },
  ],
};

export function buildReportAnatomy(): KapomReport {
  const mapTable: TableNode<AnatomyRow> = {
    type: 'table',
    columns: [
      { key: 'region', header: 'Region', width: 34 },
      { key: 'method', header: 'Call it with', width: 55 },
      { key: 'when', header: 'When it prints' },
      { key: 'layer', header: 'Layer', width: 22, align: 'center' },
    ],
    data: anatomy,
    style: { header: { fillColor: NAVY }, zebra: { even: [240, 244, 249] } },
  };

  const report = reportBuilder()
    // ── settings — once, up front (.font / .pageSetup) ──
    .font(fontConfig)
    .pageSetup({ orientation: 'portrait', margins: { top: 14, bottom: 16, left: 16, right: 16 } })
    // ── title — content, once, first page ──
    .title('Report Anatomy')
    // ── content — flows and paginates ──
    .content(
      { content: 'This heading above is .title() — the first block of content, printed once. Everything below is .content().', style: { fontSize: 9, color: GRAY } },
      spacer(5),
      { content: 'Two layers', role: 'sectionHeading' },
      spacer(1),
      { content: 'A report is a page frame (header, footer, number — reprinted on every page) wrapping a content flow (title, body, summary — printed once). The frame is configured on report.pageHeader / .pageFooter / .pageNumber; the flow is chained with .title / .content / .summary.' },
      spacer(6),
      { content: 'The map', role: 'sectionHeading' },
      spacer(2),
      untyped(mapTable),
      spacer(7),
      { content: 'Each region on this page', role: 'sectionHeading' },
      spacer(2),
      ...detail.flatMap(([region, text]): ReportNodeInput[] => [
        { content: region, style: { fontSize: 10, fontStyle: 'bold', color: NAVY } },
        { content: text, style: { fontSize: 10 } },
        spacer(3),
      ]),
      spacer(1),
      { content: 'On a longer report the frame (header, footer, number) reprints on every page, while the title and summary print once — the title on the first page, the summary pinned to the bottom of the last. See the map above for which method owns each region.', style: { fontSize: 9, color: GRAY } },
    )
    // ── summary — content, once, pinned to the page bottom ──
    .summary(
      { type: 'divider', thickness: 0.5, color: RULE },
      spacer(2),
      { content: 'This block is .summary() — content, printed once, pinned to the bottom of the last page.', align: 'center', style: { fontSize: 8.5, color: GRAY } },
    );

  // ── page frame — configured separately because it isn't part of the flow ──
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  report.pageFooter.addBlock(
    { type: 'divider', thickness: 0.2, color: RULE },
    { type: 'spacer', height: 1 },
    { content: 'page footer — .pageFooter.addBlock() — frame, repeats every page', style: { fontSize: 7.5, color: GRAY } },
  );

  report.pageNumber({ position: 'bottom-right', format: 'Page {pageNumber} of {totalPages}' });

  return report.build();
}
