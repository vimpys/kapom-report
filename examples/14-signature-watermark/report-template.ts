/**
 * File 2 of 3 — the report template.
 * A signature block as a report footer, plus a DRAFT watermark on every page.
 *   - signature — a signature line + label per slot, laid out in equal columns; it's an ordinary
 *     block, so it sits in the flow right after the content (here, after the table).
 *   - watermark — the `{ text: 'DRAFT' }` preset: a faint stamp centered on every page.
 * A signature has no "pin to bottom" flag of its own — to drop it to the page bottom instead, wrap
 * it with .summary() (which wraps a bottomAnchor); placement is the wrapper's job, not the block's.
 */
import { col, reportBuilder, spacer } from '../../src/index';
import type { KapomReport, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

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

  return reportBuilder<Sale>()
    .font(fontConfig)
    // preset — centered, opacity 0.15, fontSize 60, gray, all provided (each overridable);
    // for full control write a render callback + withOpacity() instead (see core/watermark.ts)
    .watermark({ text: 'DRAFT' })
    .title('Monthly Sales Report')
    .content(
      salesTable,
      spacer(16),
      // an ordinary block — flows right after the table. To pin it to the page bottom instead,
      // pass it to .summary() rather than .content().
      { type: 'signature', slots: [{ label: 'Prepared by' }, { label: 'Reviewed by' }, { label: 'Approved by' }] },
    )
    .build();
}
