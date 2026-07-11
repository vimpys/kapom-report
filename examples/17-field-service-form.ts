/**
 * Demo — Field Service Report (a blank, printable form)
 * Focus: a different shape from every other demo — this isn't a data-driven report but a form
 * to print and fill in by hand. It shows the layout blocks (box/row/divider/text align) composing
 * section bars, two-column detail grids, checkbox rows, and ruled writing areas — all declarative,
 * no data source. The empty cells are just bordered boxes with a spacer reserving writing height.
 */
import { createKapomReport } from '../src/index';
import type { ReportNodeInput, RGB } from '../src/index';
import { fontConfig, saveReport } from './shared';

const NAVY: RGB = [40, 78, 120]; // section bars + title
const LABEL_FILL: RGB = [238, 240, 243]; // label cells in the job-details grid
const BORDER: RGB = [180, 188, 198]; // cell / writing-area borders
const INK: RGB = [40, 40, 40];
const MUTED: RGB = [110, 110, 110];
const WHITE: RGB = [255, 255, 255];

const barText = { fontSize: 10, fontStyle: 'bold', color: WHITE } as const;
const labelText = { fontSize: 9.5, fontStyle: 'bold', color: INK } as const;

/** full-width navy section bar with white bold text */
function sectionBar(title: string): ReportNodeInput {
  return {
    type: 'box',
    background: NAVY,
    padding: 1.6,
    children: [{ content: title, style: barText }],
  };
}

/** a bordered empty rectangle reserving `height` mm for handwriting */
function writingArea(height: number): ReportNodeInput {
  return {
    type: 'box',
    borderColor: BORDER,
    padding: 1,
    children: [{ type: 'spacer', height }],
  };
}

/** a bordered area with evenly spaced horizontal rule lines to write on */
function ruledArea(lines: number, gap = 8): ReportNodeInput {
  const children: ReportNodeInput[] = [{ type: 'spacer', height: gap }];
  for (let i = 0; i < lines; i += 1) {
    children.push({ type: 'divider', thickness: 0.2, color: BORDER });
    children.push({ type: 'spacer', height: gap });
  }
  return { type: 'box', borderColor: BORDER, padding: 1, children };
}

/** one stacked "header bar + bordered label list" unit (a COMPANY / CUSTOMER details column) */
function detailUnit(header: string, labels: readonly string[]): ReportNodeInput {
  const rows: ReportNodeInput[] = [];
  labels.forEach((label, i) => {
    rows.push({ content: label, style: labelText });
    if (i < labels.length - 1) rows.push({ type: 'spacer', height: 4 });
  });
  return {
    type: 'box',
    padding: 0,
    children: [
      sectionBar(header),
      { type: 'box', borderColor: BORDER, padding: 2.5, children: rows },
    ],
  };
}

/** one row of the job-details grid: a filled label cell + an empty bordered cell to write in */
function fieldRow(label: string): ReportNodeInput {
  return {
    type: 'row',
    gap: 0,
    columns: [
      {
        width: 55,
        children: [
          { type: 'box', background: LABEL_FILL, borderColor: BORDER, padding: 2, children: [{ content: label, style: labelText }] },
        ],
      },
      {
        children: [
          { type: 'box', borderColor: BORDER, padding: 2, children: [{ type: 'spacer', height: 3.5 }] },
        ],
      },
    ],
  };
}

const report = createKapomReport({
  font: fontConfig,
  blocks: [
    { content: 'FIELD SERVICE REPORT', align: 'center', style: { fontSize: 20, fontStyle: 'bold', color: NAVY } },
    { content: 'Service Documentation Form', align: 'center', style: { fontSize: 10, color: MUTED } },
    { type: 'spacer', height: 6 },

    // ── company | customer details: two stacked units side by side ──
    {
      type: 'row',
      columns: [
        { children: [detailUnit('COMPANY DETAILS', ['Company:', 'Technician:', 'Phone:', 'License #:'])] },
        { children: [detailUnit('CUSTOMER DETAILS', ['Name:', 'Address:', 'Phone:', 'Email:'])] },
      ],
    },
    { type: 'spacer', height: 6 },

    // ── job details: label/value grid ──
    sectionBar('JOB DETAILS'),
    fieldRow('Work Order #'),
    fieldRow('Service Date'),
    fieldRow('Time In / Out'),
    fieldRow('Service Address'),
    { type: 'spacer', height: 6 },

    // ── service type: checkbox row ──
    sectionBar('SERVICE TYPE'),
    {
      type: 'box',
      borderColor: BORDER,
      padding: 2,
      children: [
        {
          // "[ ]" as the checkbox — the Unicode ballot box (U+2610) isn't in the Sarabun font,
          // so it would render blank; an ASCII substitute is glyph-safe for any registered font
          content: '[ ] Installation    [ ] Repair    [ ] Maintenance    [ ] Inspection    [ ] Emergency    [ ] Other: __________',
          style: { fontSize: 9.5, color: INK },
        },
      ],
    },
    { type: 'spacer', height: 6 },

    // ── free-text sections ──
    sectionBar('PROBLEM REPORTED BY CUSTOMER'),
    writingArea(16),
    { type: 'spacer', height: 6 },

    sectionBar('PROBLEM FOUND ON ARRIVAL'),
    writingArea(16),
    { type: 'spacer', height: 6 },

    sectionBar('WORK PERFORMED'),
    ruledArea(4),
    { type: 'spacer', height: 6 },

    { content: 'PARTS & MATERIALS USED', style: { fontSize: 11, fontStyle: 'bold', color: NAVY } },
  ],
});

saveReport(report, '17-field-service-form');
