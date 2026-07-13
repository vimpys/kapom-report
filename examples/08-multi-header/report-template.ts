/**
 * File 2 of 3 — the report template.
 * Demo — multi-level table headers via `ColumnGroup`: a group renders a spanning super-header
 * over its columns, and groups nest — here 3 levels: Quarterly → Qtr 1-4 → the three months of
 * each quarter. Spans are computed automatically from the group structure (colSpan = leaf count,
 * rowSpan stretches shallow leaves like Product/Customer/Total down to the bottom header row) —
 * you never write a span by hand.
 * Landscape + narrow margins because 14 leaf columns need the width; month columns have no fixed
 * width so AutoTable auto-fits them.
 */
import { reportBuilder } from '../../src/index';
import type { ColumnGroup, DataColumn, KapomReport, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

type MonthKey =
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec';

const MONTH_KEYS: readonly MonthKey[] = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** plain integer with a thousands separator (dash for zero) */
const compact = (n: number): string => (n > 0 ? n.toLocaleString('en-US') : '-');

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// `type: 'data'` is the default — omit it; no explicit width lets AutoTable auto-fit the 12 months
const month = (key: MonthKey): DataColumn<Sale> => ({
  key,
  header: capitalize(key),
  align: 'right',
  formatter: (value) => compact(Number(value)),
});

/** a quarter = a column group over its three months — groups nest, so this sits inside 'Quarterly' */
const quarter = (header: string, m1: MonthKey, m2: MonthKey, m3: MonthKey): ColumnGroup<Sale> => ({
  type: 'group',
  header,
  columns: [month(m1), month(m2), month(m3)],
});

export function buildQuarterlySales(sales: Sale[]): KapomReport {
  const salesTable: TableNode<Sale> = {
    type: 'table',
    columns: [
      // plain leaf columns span all 3 header rows automatically (rowSpan, centered vertically)
      { key: 'product', header: 'Product', width: 30 },
      { key: 'customer', header: 'Customer', width: 22 },
      // 3-level header: Quarterly → Qtr 1-4 → the three months of each quarter
      {
        type: 'group',
        header: 'Quarterly',
        columns: [
          quarter('Qtr 1', 'jan', 'feb', 'mar'),
          quarter('Qtr 2', 'apr', 'may', 'jun'),
          quarter('Qtr 3', 'jul', 'aug', 'sep'),
          quarter('Qtr 4', 'oct', 'nov', 'dec'),
        ],
      },
      {
        type: 'computed',
        header: 'Total',
        align: 'right',
        width: 22,
        compute: (row) => MONTH_KEYS.reduce((sum, key) => sum + row[key], 0),
        formatter: (value) => compact(Number(value)),
        cellStyle: { fontStyle: 'bold' },
      },
    ],
    data: sales,
  };

  return reportBuilder<Sale>()
    .font(fontConfig)
    .pageSetup({ orientation: 'landscape', margins: { top: 12, bottom: 12, left: 10, right: 10 } })
    .title('Quarterly Sales — 3-level column-group header')
    .content(salesTable)
    .build();
}
