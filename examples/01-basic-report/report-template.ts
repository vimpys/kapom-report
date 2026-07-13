/**
 * File 2 of 3 — the report template.
 * Demo — the smallest possible report: a title and one table, assembled with the
 * `reportBuilder()` fluent chain. `.title()` = the once-at-top region, `.content()` = the
 * flowing body. Columns are just `{ key, header }` — `type: 'data'` is the default and may be
 * omitted. No new jsPDF()/RenderEngine/createBlock anywhere; page size defaults to a4/portrait.
 *
 * Data-agnostic: exposed as `buildDailySales(sales)` — swap in any `Sale[]` and the layout holds.
 * Every demo after this one grows from this exact shape.
 */
import { reportBuilder } from '../../src/index';
import type { KapomReport } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

export function buildDailySales(sales: Sale[]): KapomReport {
  return reportBuilder<Sale>()
    .font(fontConfig)
    .title('Daily Sales Report')
    .content({
      type: 'table',
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'qty', header: 'Qty', align: 'right' },
      ],
      data: sales,
    })
    .build();
  // `.build()` returns a KapomReport so the runner decides what to do with it. In real code you
  // can also end the chain with an output call directly — build + write in one step:
  //   .save('daily-sales.pdf')   // Node: writes the file / browser: triggers a download
  //   .preview()                 // Node: opens the OS PDF viewer / browser: opens a new tab
}
