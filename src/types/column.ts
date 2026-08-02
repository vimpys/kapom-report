import type { Decimalish } from '../numeric/numeric-strategy';
import type { CellStyle, HAlign, NumberFormat } from './primitives';

export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type RowNumberMode = 'continuous' | 'per-group' | 'per-page';

/** default when a rowNumber/runningTotal column doesn't set `mode` — counts continuously across the whole report */
export const DEFAULT_ROW_NUMBER_MODE = 'continuous' as const;

interface ColumnBase {
  header: string;
  /** data cell alignment; default 'left' */
  align?: HAlign;
  /** header cell alignment; default = the `align` value */
  headerAlign?: HAlign;
  width?: number;
  /** static style for this column's head cell (all table/column style is `CellStyle`) */
  headerStyle?: Partial<CellStyle>;
  /** static style for this column's body cells — incl. `fillColor` for a column background */
  cellStyle?: Partial<CellStyle>;
  /** conditionally show/hide; default true */
  visible?: boolean | (() => boolean);
}

/**
 * column base for the row-typed column kinds (data/computed/runningTotal) — adds `conditionalStyle`,
 * which rowNumber (not row-typed) doesn't carry.
 */
interface TypedColumnBase<T> extends ColumnBase {
  /**
   * value-driven counterpart of `cellStyle` — returns a `Partial<CellStyle>` for THIS column's body
   * cell based on the row (e.g. a red `fillColor` when the value is negative), or `undefined` to
   * leave it to `cellStyle`. Mirrors the table-level `style.conditional` (row) at the column scope,
   * and is applied as the most specific layer (on top of `style.conditional`/`style.zebra`).
   */
  conditionalStyle?: (row: T) => Partial<CellStyle> | undefined;
}

export interface DataColumn<T> extends TypedColumnBase<T> {
  /** the default column kind — may be omitted; normalized to 'data' at build time */
  type?: 'data';
  key: keyof T;
  numberFormat?: NumberFormat;
  /** the engine automatically sums this column in the group footer + summary */
  aggregate?: AggregateFn | ((rows: readonly T[]) => Decimalish);
  formatter?: (value: T[keyof T], row: T) => string;
  /** render override — returns a string; conditional styling is handled by a separate resolver */
  cellRenderer?: (value: T[keyof T], row: T) => string;
}

export interface RowNumberColumn extends ColumnBase {
  type: 'rowNumber';
  /** starting number; default 1 */
  startAt?: number;
  /** continuous = counts across the whole report, per-group = resets every group, per-page = resets every page (two-pass) */
  mode?: RowNumberMode;
  formatter?: (n: number) => string;
}

export interface ComputedColumn<T> extends TypedColumnBase<T> {
  type: 'computed';
  compute: (row: T) => Decimalish;
  numberFormat?: NumberFormat;
  aggregate?: AggregateFn;
  formatter?: (value: Decimalish, row: T) => string;
}

export interface RunningTotalColumn<T> extends TypedColumnBase<T> {
  type: 'runningTotal';
  valueOf: (row: T) => Decimalish;
  mode?: 'continuous' | 'per-group';
  numberFormat?: NumberFormat;
  formatter?: (accumulated: Decimalish) => string;
}

export type ReportColumn<T> =
  | DataColumn<T>
  | RowNumberColumn
  | ComputedColumn<T>
  | RunningTotalColumn<T>;

/**
 * a super-header spanning its child columns — renders a multi-row header where `header` sits above
 * its `columns` with a colSpan. Children can be leaf columns OR other groups (nested to any depth),
 * so a 3+ level header (e.g. Year → Half → Quarter) is just groups inside groups.
 */
export interface ColumnGroup<T> {
  type: 'group';
  header: string;
  columns: readonly TableColumn<T>[];
  /** super-header cell alignment — default 'center' */
  headerAlign?: HAlign;
}

/** a table column at any level — either a leaf column or a group spanning several columns */
export type TableColumn<T> = ReportColumn<T> | ColumnGroup<T>;

/** alias for a data column with `type` omitted — the default kind (kept for the facade's shorthand type) */
export type DataColumnShorthand<T> = Omit<DataColumn<T>, 'type'>;

/**
 * Column-constructor namespace bound to the row type T (Zod-style `col.data()`/`col.group()`) — a
 * lighter way to write columns than object literals, especially for a group tree (`col.group(...)`
 * composes with `.map()`, no chain/callback nesting). T must be fixed up front because `key` is
 * `keyof T` and computed/runningTotal callbacks receive a `T` — hence a `col<Row>()` factory rather
 * than a bare namespace. Each method takes the kind's required fields positionally; everything else
 * (align/width/aggregate/formatter/numberFormat/cellStyle/visible/…) goes in `extra`.
 */
export interface ColumnHelpers<T> {
  data(key: keyof T, header: string, extra?: Partial<Omit<DataColumn<T>, 'type' | 'key' | 'header'>>): DataColumn<T>;
  computed(header: string, compute: (row: T) => Decimalish, extra?: Partial<Omit<ComputedColumn<T>, 'type' | 'header' | 'compute'>>): ComputedColumn<T>;
  runningTotal(header: string, valueOf: (row: T) => Decimalish, extra?: Partial<Omit<RunningTotalColumn<T>, 'type' | 'header' | 'valueOf'>>): RunningTotalColumn<T>;
  rowNumber(extra?: Partial<Omit<RowNumberColumn, 'type'>>): RowNumberColumn;
  group(header: string, columns: readonly TableColumn<T>[], extra?: Partial<Omit<ColumnGroup<T>, 'type' | 'header' | 'columns'>>): ColumnGroup<T>;
}

/** create the column-constructor namespace for row type T — `const c = col<Sale>(); c.data('qty','Qty')` */
export function col<T>(): ColumnHelpers<T> {
  return {
    data: (key, header, extra) => ({ type: 'data', key, header, ...extra }),
    computed: (header, compute, extra) => ({ type: 'computed', header, compute, ...extra }),
    runningTotal: (header, valueOf, extra) => ({ type: 'runningTotal', header, valueOf, ...extra }),
    rowNumber: (extra) => ({ type: 'rowNumber', header: '#', ...extra }),
    group: (header, columns, extra) => ({ type: 'group', header, columns, ...extra }),
  };
}

/** fill in the default `type: 'data'` when a leaf column omits it — everything downstream sees a resolved column */
export function normalizeColumn<T>(col: ReportColumn<T>): ReportColumn<T> {
  return col.type === undefined ? { ...col, type: 'data' } : col;
}

export function isColumnGroup<T>(col: TableColumn<T>): col is ColumnGroup<T> {
  return col.type === 'group';
}

/** expand any groups (recursively) into their leaf columns, filling the default `type: 'data'` — body/width/aggregate all run on these */
export function flattenColumns<T>(columns: readonly TableColumn<T>[]): ReportColumn<T>[] {
  return columns.flatMap((col) => (isColumnGroup(col) ? flattenColumns(col.columns) : [normalizeColumn(col)]));
}

/** the number of header rows this column needs — 1 for a leaf, 1 + the deepest child for a group (drives the multi-row header) */
export function columnDepth<T>(col: TableColumn<T>): number {
  return isColumnGroup(col) ? 1 + Math.max(0, ...col.columns.map(columnDepth)) : 1;
}

/** resolve alignment: header falls back to data, data falls back to 'left' */
export interface ResolvedAlign {
  header: HAlign;
  data: HAlign;
}

/**
 * Whether a column is numeric on the strength of what it already declares — no inspection of the
 * data. `computed`/`runningTotal` produce a `Decimalish` by contract and `rowNumber` counts rows;
 * a data column that set `numberFormat` has said as much itself. Deliberately not inferred from the
 * values: a column of order numbers is numeric to a scan and is not a quantity, and this stays the
 * question-free half of the rule.
 */
export function isNumericColumn<T>(col: ReportColumn<T>): boolean {
  if (col.type === 'computed' || col.type === 'runningTotal' || col.type === 'rowNumber') return true;

  return col.numberFormat !== undefined;
}

export function resolveColumnAlign<T>(col: ReportColumn<T>): ResolvedAlign {
  // numbers read right-aligned in every report, so a column already known to hold them doesn't
  // need `align: 'right'` spelled out — an explicit `align` still wins, this is only the default
  const data = col.align ?? (isNumericColumn(col) ? 'right' : 'left');

  // header defaults to center (a common report convention — e.g. a centered 'Qty' over right-aligned
  // numbers); set `headerAlign` to override per column
  return { data, header: col.headerAlign ?? 'center' };
}

/** structural param so it accepts a leaf, a shorthand, or a group (a group has no `visible` → always shown) */
export function isColumnVisible(col: { visible?: boolean | (() => boolean) }): boolean {
  if (col.visible === undefined) return true;

  return typeof col.visible === 'function' ? col.visible() : col.visible;
}

/** only these 2 of the 4 column kinds carry an `aggregate` field (see DataColumn/ComputedColumn above) */
export function isAggregatableColumn<T>(
  col: ReportColumn<T>,
): col is DataColumn<T> | ComputedColumn<T> {
  return col.type === 'data' || col.type === 'computed';
}
