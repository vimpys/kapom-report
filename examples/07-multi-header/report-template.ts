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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB } from '../../src/index';
import { fontConfig } from '../shared';
import type { Sale } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

const NAVY: RGB = [31, 63, 112];
const GRAY: RGB = [110, 110, 110];
const RULE: RGB = [205, 210, 218];

/** the brand header repeated at the top of every page — logo + company name (same brand-header pattern across the table demos) */
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

type MonthKey =
  | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'
  | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec';

const MONTH_KEYS: readonly MonthKey[] = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** which months make up each quarter — lets `quarter(label)` build its group without repeating month keys */
const QUARTERS: Record<string, MonthKey[]> = {
  'Qtr 1': ['jan', 'feb', 'mar'],
  'Qtr 2': ['apr', 'may', 'jun'],
  'Qtr 3': ['jul', 'aug', 'sep'],
  'Qtr 4': ['oct', 'nov', 'dec'],
};

/** plain integer with a thousands separator (dash for zero) */
const compact = (n: number): string => (n > 0 ? n.toLocaleString('en-US') : '-');

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// column constructors bound to Sale — `c.data`/`c.group`/`c.computed` (Zod-style), composes with .map()
const c = col<Sale>();

// no explicit width lets AutoTable auto-fit the 12 months
const month = (key: MonthKey) => c.data(key, capitalize(key), { align: 'right', formatter: (v) => compact(Number(v)) });

/** a quarter = a column group over its three months — groups nest, so this sits inside 'Quarterly' */
const quarter = (label: string) => c.group(label, QUARTERS[label]!.map(month));

export function buildQuarterlySales(sales: Sale[]): KapomReport {
  const report = reportBuilder<Sale>()
    .font(fontConfig)
    .pageSetup({ orientation: 'landscape', margins: { top: 12, bottom: 12, left: 10, right: 10 } })
    .title('Quarterly Sales — 3-level column-group header')
    .table({
      columns: [
        // plain leaf columns span all 3 header rows automatically (rowSpan, centered vertically)
        c.data('product', 'Product', { width: 30 }),
        c.data('customer', 'Customer', { width: 22 }),
        // 3-level header: Quarterly → Qtr 1-4 → the three months of each quarter — `.table()` takes
        // column groups too (a group's children may even use the { key, header } shorthand)
        c.group('Quarterly', Object.keys(QUARTERS).map(quarter)),
        c.computed('Total', (row) => MONTH_KEYS.reduce((sum, key) => sum + row[key], 0), {
          align: 'right',
          width: 22,
          formatter: (value) => compact(Number(value)),
          cellStyle: { fontStyle: 'bold' },
        }),
      ],
      data: sales,
    });

  // brand page-header band — repeats on every page; reserved height is auto-measured from the blocks
  report.pageHeader
    .addBlock(brandHeader)
    .addBlock({ type: 'spacer', height: 1.5 })
    .addBlock({ type: 'divider', thickness: 0.2, color: RULE })
    .addBlock({ type: 'spacer', height: 2 });

  return report.build();
}
