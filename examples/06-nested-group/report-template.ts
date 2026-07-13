/**
 * File 2 of 3 — the report template.
 * Demo — nested group: a group nested 2 levels deep (region → category) via
 * GroupResolver.subGroup — a band at every level (inner level labels are indented), a subtotal
 * per sub-group (the segment's foot), a subtotal per region (a single row on a gray
 * band-matching background), and a grand total at the end. Nests to N levels — each level has
 * its own labels/keepTogether.
 * Compare with 05-group-report, which groups only one level deep.
 */
import { nativeNumeric, reportBuilder } from '../../src/index';
import type { KapomReport, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { BranchSale } from './data';

export function buildBranchSales(branchSales: BranchSale[]): KapomReport {
  const nestedTable: TableNode<BranchSale> = {
    type: 'table',
    columns: [
      // no leading rowNumber — the subtotal label lands on the first empty cell (the first
      // column); if that were a narrow rowNumber column, a long label would wrap awkwardly
      { key: 'product', header: 'Item' },
      { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { key: 'price', header: 'Price', align: 'right', numberFormat: {} },
      {
        type: 'computed',
        header: 'Amount',
        align: 'right',
        compute: (row) => nativeNumeric.multiply(row.qty, row.price),
        aggregate: 'sum',
      },
    ],
    data: branchSales,
    summaryLabel: 'Grand Total',
    group: {
      by: 'region',
      headerLabel: (key) => `Region: ${key}`,
      footerLabel: (key) => `Subtotal — ${key}`,
      keepTogether: { minRowsWithHeader: 2 },
      // one more level inside every region — recursive: a subGroup can have its own subGroup
      subGroup: {
        by: 'category',
        footerLabel: (key) => `Subtotal ${key}`,
      },
    },
  };

  return reportBuilder<BranchSale>()
    .font(fontConfig)
    .title('Branch Sales — nested group, region → category')
    .content(nestedTable)
    .build();
}
