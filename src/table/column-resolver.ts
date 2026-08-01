import { KapomError } from '../core/errors';
import { normalizeText } from '../core/text-normalizer';
import { formatNumber } from '../format/number-format';
import { asDecimalish, computeAggregate, isFiniteDecimalish } from './aggregate';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { ComputedColumn, DataColumn, ReportColumn, ResolvedAlign, TableColumn } from '../types/column';
import { DEFAULT_ROW_NUMBER_MODE, flattenColumns, isAggregatableColumn, isColumnVisible, resolveColumnAlign } from '../types/column';
import type { NumberFormat } from '../types/primitives';
import type { TableNode } from '../types/node';

/**
 * default label for the summary row — English so a zero-config table (no font registered) never
 * hits the Thai font guard just from adding an `aggregate` column (2026-07-07 — was 'รวม'; override
 * via `summaryLabel` if a Thai label is wanted, same as any other user-facing text)
 */
export const DEFAULT_SUMMARY_LABEL = 'Total';

/** default text for the No-Data fallback (`data: []`) — same zero-config rationale as DEFAULT_SUMMARY_LABEL */
export const DEFAULT_NO_DATA_TEXT = 'No data';

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

/** flattens any groups into leaf columns, filters by visibility + fails fast if none remain */
export function visibleColumns<T>(
  columns: readonly TableColumn<T>[],
): ReportColumn<T>[] {
  const visible = flattenColumns(columns).filter(isColumnVisible);
  if (visible.length === 0) {
    throw new KapomError('table requires at least 1 visible column');
  }
  return visible;
}

function stringifyCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Locator prefix for every numeric-boundary error — the column always, plus the 1-based row when
 * the caller knows it (a bad value in row 400 is otherwise a needle in a haystack). The row number
 * is relative to the segment being resolved, so in a grouped table it counts within that group.
 */
function cellContext(columnHeader: string, rowIndex?: number): string {
  return rowIndex === undefined ? `column '${columnHeader}'` : `column '${columnHeader}' row ${rowIndex + 1}`;
}

/** every value entering arithmetic/formatting goes through the one boundary in aggregate.ts (see asDecimalish) */
function asDecimalishCell(value: unknown, columnHeader: string, rowIndex?: number): Decimalish {
  return asDecimalish(value, cellContext(columnHeader, rowIndex));
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
    if (col.type === 'runningTotal' && (col.mode ?? DEFAULT_ROW_NUMBER_MODE) === 'per-group') {
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
    // `undefined` = the `type: 'data'` shorthand (columns are normalized before reaching here, but
    // the static type still carries the optional so the switch must cover it) — same branch as 'data'
    case undefined:
    case 'data': {
      const value = row[col.key];
      if (col.cellRenderer) return col.cellRenderer(value, row);
      if (col.formatter) return col.formatter(value, row);
      if (col.numberFormat) {
        return formatNumber(
          asDecimalishCell(value, col.header, localIndex),
          numeric,
          col.numberFormat,
        );
      }
      return stringifyCell(value);
    }
    case 'rowNumber': {
      const mode = col.mode ?? DEFAULT_ROW_NUMBER_MODE;
      // 'per-page' can't be resolved here — this step is pure and jsPDF-agnostic, so it has no
      // idea where AutoTable will actually break pages. This produces a placeholder (continuous
      // numbering, same as when unset) purely so column-width measurement has a realistic-looking
      // string to measure; TableBlock overwrites the drawn text per-cell via a willDrawCell hook
      // once AutoTable has decided which page each row really lands on (see perPageRowNumberHook)
      const base = mode === 'per-group' ? 0 : state.rowOffset;
      const n = (col.startAt ?? 1) + base + localIndex;
      return col.formatter ? col.formatter(n) : String(n);
    }
    case 'computed': {
      const value = col.compute(row);
      if (col.formatter) return col.formatter(value, row);
      // computed is numeric by contract (returns Decimalish) → always formatted (default th-TH);
      // the contract is only a type, so the returned value is still checked like any other input
      return formatNumber(asDecimalishCell(value, col.header, localIndex), numeric, col.numberFormat);
    }
    case 'runningTotal': {
      const previous = state.runningTotals[colIndex] ?? 0;
      const accumulated = numeric.add(previous, asDecimalishCell(col.valueOf(row), col.header, localIndex));
      state.runningTotals[colIndex] = accumulated;
      return col.formatter
        ? col.formatter(accumulated)
        : formatNumber(accumulated, numeric, col.numberFormat);
    }
  }
  const exhaustive: never = col;
  return exhaustive;
}

/** true when an aggregate row has nothing to put in this column (no aggregate declared, or not a data/computed column) — the exact rule resolveAggregateRow uses to find the label's slot */
function isAggregateLabelSlot<T>(col: ReportColumn<T>): boolean {
  if (!isAggregatableColumn(col)) return true;
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
 * (it used to check only foot[0], so the label went missing silently if the
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
  const hasAggregate = columns.some((col) => isAggregatableColumn(col) && col.aggregate !== undefined);
  if (!hasAggregate) return undefined;

  const foot = columns.map((col) => {
    if (!isAggregatableColumn(col)) return '';
    if (col.aggregate === undefined) return '';

    // 'count' is the one aggregate that never reads the cell values, only how many rows there are
    // (see computeAggregate) — so counting a text column (e.g. product names) is legitimate and
    // must not be forced through the numeric boundary below. It's always a whole number too:
    // formatting it to 2 decimal places would read oddly (e.g. "3.00").
    if (col.aggregate === 'count') return String(rows.length);

    if (typeof col.aggregate === 'function') {
      // a custom aggregate fn only exists on DataColumn (see types/column.ts). This value came
      // from the user's own code rather than their data source, so a non-numeric string is read as
      // a deliberate literal ('n/a', '—' for "no meaningful total") and printed verbatim instead of
      // being rejected — it used to go through Intl and land on the page as "NaN".
      const custom = col.aggregate(rows);
      return isFiniteDecimalish(custom) ? formatAggregateResult(col, custom, numeric) : String(custom);
    }

    // discriminate on the positive 'computed' — a DataColumn's `type` is optional ('data' | undefined),
    // so `=== 'data'` wouldn't exclude it from the negative branch
    const values =
      col.type === 'computed'
        ? rows.map((row, index) => asDecimalishCell(col.compute(row), col.header, index))
        : rows.map((row, index) => asDecimalishCell(row[col.key], col.header, index));

    return formatAggregateResult(col, computeAggregate(col.aggregate, values, numeric), numeric);
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
