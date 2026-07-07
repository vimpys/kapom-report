import { KapomError } from '../core/errors';
import { normalizeText } from '../core/text-normalizer';
import { formatNumber } from '../format/number-format';
import { computeAggregate } from './aggregate';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { ComputedColumn, DataColumn, ReportColumn, ResolvedAlign } from '../types/column';
import { isColumnVisible, resolveColumnAlign } from '../types/column';
import type { NumberFormat } from '../types/primitives';
import type { TableNode } from '../types/node';

/** default label for the summary row — matches the default th-TH locale */
export const DEFAULT_SUMMARY_LABEL = 'รวม';

/** default text for the No-Data fallback (`data: []`) — matches the default th-TH locale, same as DEFAULT_SUMMARY_LABEL */
export const DEFAULT_NO_DATA_TEXT = 'ไม่มีข้อมูล';

/**
 * The pure output from the column system — plain strings, ready to hand to AutoTable
 * kept entirely separate from jsPDF so aggregate/format/derived columns can be tested directly
 */
export interface ResolvedTableContent {
  head: string[];
  body: string[][];
  /** undefined when no column declares an aggregate */
  foot: string[] | undefined;
  aligns: ResolvedAlign[];
  widths: (number | undefined)[];
}

/**
 * State that flows across segments (groups) — 'continuous' mode reads/accumulates through this
 * A grouped table builds this once, then passes it into resolveSegmentBody for each group, in render order.
 */
export interface SegmentState {
  /** number of rows already resolved before this segment (the base for continuous rowNumber) */
  rowOffset: number;
  /** running total per column index (continuous runningTotal) */
  runningTotals: (Decimalish | undefined)[];
}

export function createSegmentState(columnCount: number): SegmentState {
  return {
    rowOffset: 0,
    runningTotals: Array.from({ length: columnCount }, () => undefined),
  };
}

/** filters by visibility + fails fast if no columns remain */
export function visibleColumns<T>(
  columns: readonly ReportColumn<T>[],
): ReportColumn<T>[] {
  const visible = columns.filter(isColumnVisible);
  if (visible.length === 0) {
    throw new KapomError('table requires at least 1 visible column');
  }
  return visible;
}

function stringifyCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function asDecimalishCell(value: unknown, columnHeader: string): Decimalish {
  if (typeof value === 'number' || typeof value === 'string') return value;
  throw new KapomError(
    `column '${columnHeader}': numberFormat requires a number|string value (got ${typeof value})`,
  );
}

/**
 * Resolves the body of one segment (the whole table when ungrouped, one group when grouped)
 * mutates state: the per-group accumulator resets at the start of a segment, rowOffset advances at the end
 */
export function resolveSegmentBody<T>(
  columns: readonly ReportColumn<T>[],
  rows: readonly T[],
  numeric: NumericStrategy,
  state: SegmentState,
): string[][] {
  columns.forEach((col, index) => {
    if (col.type === 'runningTotal' && (col.mode ?? 'continuous') === 'per-group') {
      state.runningTotals[index] = undefined;
    }
  });

  const body = rows.map((row, localIndex) =>
    columns.map((col, colIndex) =>
      normalizeText(resolveCell(col, row, localIndex, colIndex, state, numeric)),
    ),
  );

  state.rowOffset += rows.length;
  return body;
}

function resolveCell<T>(
  col: ReportColumn<T>,
  row: T,
  localIndex: number,
  colIndex: number,
  state: SegmentState,
  numeric: NumericStrategy,
): string {
  switch (col.type) {
    case 'data': {
      const value = row[col.key];
      if (col.cellRenderer) return col.cellRenderer(value, row);
      if (col.formatter) return col.formatter(value, row);
      if (col.numberFormat) {
        return formatNumber(
          asDecimalishCell(value, col.header),
          numeric,
          col.numberFormat,
        );
      }
      return stringifyCell(value);
    }
    case 'rowNumber': {
      const mode = col.mode ?? 'continuous';
      if (mode === 'per-page') {
        // per-page needs to know the real page breaks → requires a two-pass layout (roadmap step 7)
        throw new KapomError(`rowNumber mode 'per-page' is not supported yet — requires a two-pass layout`);
      }
      const base = mode === 'continuous' ? state.rowOffset : 0;
      const n = (col.startAt ?? 1) + base + localIndex;
      return col.formatter ? col.formatter(n) : String(n);
    }
    case 'computed': {
      const value = col.compute(row);
      if (col.formatter) return col.formatter(value, row);
      // computed is numeric by contract (returns Decimalish) → always formatted (default th-TH)
      return formatNumber(value, numeric, col.numberFormat);
    }
    case 'runningTotal': {
      const previous = state.runningTotals[colIndex] ?? 0;
      const accumulated = numeric.add(previous, col.valueOf(row));
      state.runningTotals[colIndex] = accumulated;
      return col.formatter
        ? col.formatter(accumulated)
        : formatNumber(accumulated, numeric, col.numberFormat);
    }
  }
}

/** true when an aggregate row has nothing to put in this column (no aggregate declared, or not a data/computed column) — the exact rule resolveAggregateRow uses to find the label's slot */
function isAggregateLabelSlot<T>(col: ReportColumn<T>): boolean {
  if (col.type !== 'data' && col.type !== 'computed') return true;
  return col.aggregate === undefined;
}

/**
 * Index of the first column an aggregate row's label can land on (see resolveAggregateRow) —
 * -1 if every column has an aggregate, meaning the label gets omitted entirely. Exposed so the
 * render layer can merge that slot with any immediately-following empty columns into one wider
 * display cell (colSpan), without needing resolveAggregateRow to also return this index.
 */
export function firstAggregateLabelIndex<T>(columns: readonly ReportColumn<T>[]): number {
  return columns.findIndex(isAggregateLabelSlot);
}

/**
 * A 'data' column's row cells never apply Intl formatting unless `numberFormat` is set (see
 * resolveCell — no numberFormat = raw `String(value)`, e.g. an integer-like Qty column shows
 * "42" with no forced decimals). An aggregate on that same column used to ignore this and always
 * fall back to DEFAULT_NUMBER_FORMAT's 2 decimal places, so a subtotal could show "175.00" for a
 * column whose rows never had decimals at all. This resolves the format an aggregate cell should
 * use so it stays consistent with its own column's row-level behavior: a 'data' column with no
 * `numberFormat` gets 0 decimal places instead of 2 (still through Intl.NumberFormat — not a raw
 * stringify — so float arithmetic artifacts from summing/averaging are still rounded away, and
 * locale grouping still applies); 'computed'/'runningTotal' columns are untouched here since they
 * already format unconditionally at the row level too (see resolveCell), so they were already
 * consistent between row and aggregate before this fix.
 */
const UNCONFIGURED_DATA_COLUMN_FORMAT: NumberFormat = { minimumFractionDigits: 0, maximumFractionDigits: 0 };

function formatAggregateResult<T>(
  col: DataColumn<T> | ComputedColumn<T>,
  result: Decimalish,
  numeric: NumericStrategy,
): string {
  const format = col.type === 'data' && col.numberFormat === undefined ? UNCONFIGURED_DATA_COLUMN_FORMAT : col.numberFormat;
  return formatNumber(result, numeric, format);
}

/**
 * An aggregate row (group footer / grand total) — the label lands on "the first empty cell"
 * (review fix #4: it used to check only foot[0], so the label went missing silently if the
 * first column had an aggregate); if every cell ends up with a value (every column has an
 * aggregate), the label is omitted — there's nowhere to put it without overwriting a total
 * returns undefined when no column declares an aggregate
 */
export function resolveAggregateRow<T>(
  columns: readonly ReportColumn<T>[],
  rows: readonly T[],
  numeric: NumericStrategy,
  label: string,
): string[] | undefined {
  const hasAggregate = columns.some(
    (col) => (col.type === 'data' || col.type === 'computed') && col.aggregate !== undefined,
  );
  if (!hasAggregate) return undefined;

  const foot = columns.map((col) => {
    if (col.type !== 'data' && col.type !== 'computed') return '';
    if (col.aggregate === undefined) return '';

    if (typeof col.aggregate === 'function') {
      // a custom aggregate fn only exists on DataColumn (see types/column.ts)
      return formatAggregateResult(col, col.aggregate(rows), numeric);
    }

    const values =
      col.type === 'data'
        ? rows.map((row) => asDecimalishCell(row[col.key], col.header))
        : rows.map((row) => col.compute(row));

    const result = computeAggregate(col.aggregate, values, numeric);
    // count is always a whole number — formatting it to 2 decimal places would read oddly (e.g. "3.00")
    return col.aggregate === 'count' ? String(result) : formatAggregateResult(col, result, numeric);
  });

  const firstEmpty = firstAggregateLabelIndex(columns);
  if (firstEmpty !== -1) foot[firstEmpty] = label;
  return foot.map((cell) => normalizeText(cell));
}

/** an ungrouped table = a single segment — per-group mode is naturally identical to continuous */
export function resolveTableContent<T>(
  node: TableNode<T>,
  numeric: NumericStrategy,
): ResolvedTableContent {
  const columns = visibleColumns(node.columns);
  const state = createSegmentState(columns.length);
  const body = resolveSegmentBody(columns, node.data, numeric, state);
  const foot = resolveAggregateRow(
    columns,
    node.data,
    numeric,
    node.summaryLabel ?? DEFAULT_SUMMARY_LABEL,
  );

  return {
    head: columns.map((col) => normalizeText(col.header)),
    body,
    foot,
    aligns: columns.map(resolveColumnAlign),
    widths: columns.map((col) => col.width),
  };
}
