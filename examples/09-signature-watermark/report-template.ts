/**
 * File 2 of 3 — the report template.
 * A signature block as a report footer, plus a DRAFT watermark on every page.
 *   - signature — a signature line + label per slot, laid out in equal columns; it's an ordinary
 *     block, so it sits in the flow right after the content (here, after the table).
 *   - watermark — the `{ text: 'DRAFT' }` preset: a faint stamp centered on every page.
 * A signature has no "pin to bottom" flag of its own — to drop it to the page bottom instead, wrap
 * it with .summary() (which wraps a bottomAnchor); placement is the wrapper's job, not the block's.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, reportBuilder, spacer } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the brand header repeated at the top of every page — logo + report name */
const brandHeader: ReportNodeInput = {
  type: 'row',
  columns: [
    { width: 14, children: [{ type: 'image', data: logo, format: 'PNG', width: 14, height: 14 }] },
    {
      children: [
        { type: 'spacer', height: 2 },
        { content: 'Kapom Report', style: { fontSize: 13, fontStyle: 'bold', color: NAVY } },
        { content: 'kapom-soft', style: { fontSize: 8, color: GRAY } },
      ],
    },
  ],
};

export function buildSignatureReport(sales: Sale[]): KapomReport {
  const c = col<Sale>();
  const salesTable: TableNode<Sale> = {
    type: 'table',
    columns: [
      c.data('product', 'Product'),
      c.data('qty', 'Qty', { align: 'right', aggregate: 'sum' }),
    ],
    data: sales,
    summaryLabel: 'Total',
  };

  const report = reportBuilder<Sale>()
    .font(fontConfig)
    // preset — repeated diagonally across the page. layout 'tile' + rotate 45 = the classic
    // "CONFIDENTIAL" pattern; showOnFirstPage defaults to false, so set it here (this report is one page).
    // opacity/color/fontFamily fall back to defaults; for full control write a render callback instead.
    .watermark({ text: 'DRAFT', layout: 'tile', rotate: 45, fontSize: 30, showOnFirstPage: true })
    .title('Monthly Sales Report')
    .content(
      salesTable,
      spacer(16),
      // an ordinary block — flows right after the table. To pin it to the page bottom instead,
      // pass it to .summary() rather than .content().
      { type: 'signature', slots: [{ label: 'Prepared by' }, { label: 'Reviewed by' }, { label: 'Approved by' }] },
    );

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  return report.build();
}
