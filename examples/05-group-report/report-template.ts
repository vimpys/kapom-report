/**
 * File 2 of 3 — the report template.
 * Demo — grouped table (composite): a gray band per group + per-group rowNumber + a subtotal
 * per group + a grand total at the end.
 * Focus:
 *   group        — full GroupResolver: custom headerLabel / footerLabel per group
 *   rowNumber    — `mode: 'per-group'` resets the counter at every group (vs 'continuous')
 *   keepTogether — a band never gets stranded alone at the bottom of a page
 *                  (minRowsWithHeader: the band only starts if ≥ N data rows fit under it)
 * Compare with 06-nested-group, which nests a second group level inside this shape.
 */
import { nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { RegionSale } from './data';

/** compose a grouped, subtotaled sales table from raw rows */
export function buildRegionalSales(regionSales: RegionSale[]): KapomReport {
  const groupedTable: TableNode<RegionSale> = {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right', width: 12, mode: 'per-group' },
      { key: 'product', header: 'Product' }, // `type: 'data'` is the default — omit it
      { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { key: 'price', header: 'Price', align: 'right', numberFormat: {} },
      {
        type: 'computed',
        header: 'Amount',
        align: 'right',
        compute: (row) => nativeNumeric.multiply(row.qty, row.price),
        aggregate: 'sum',
        numberFormat: { fractionDigits: 2 }, // shorthand — one value sets min and max fraction digits
      },
    ],
    data: regionSales,
    summaryLabel: 'Grand Total',
    group: {
      by: 'region',
      headerLabel: (key, rows) => `Region: ${key} (${rows.length} items)`,
      footerLabel: (key) => `Subtotal ${key}`,
      keepTogether: { minRowsWithHeader: 2 },
    },
  };

  return reportBuilder<RegionSale>()
    .font(fontConfig)
    .title('Regional Sales — grouped, subtotaled, grand total')
    .content(groupedTable)
    .build();
}
