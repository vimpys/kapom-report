import type { Decimalish } from '../numeric/numeric-strategy';
import type { HAlign, NumberFormat, TextStyle } from './primitives';

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
  headerStyle?: Partial<TextStyle>;
  cellStyle?: Partial<TextStyle>;
  /** conditionally show/hide; default true */
  visible?: boolean | (() => boolean);
}

export interface DataColumn<T> extends ColumnBase {
  type: 'data';
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

export interface ComputedColumn<T> extends ColumnBase {
  type: 'computed';
  compute: (row: T) => Decimalish;
  numberFormat?: NumberFormat;
  aggregate?: AggregateFn;
  formatter?: (value: Decimalish, row: T) => string;
}

export interface RunningTotalColumn<T> extends ColumnBase {
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

/** resolve alignment: header falls back to data, data falls back to 'left' */
export interface ResolvedAlign {
  header: HAlign;
  data: HAlign;
}

export function resolveColumnAlign<T>(col: ReportColumn<T>): ResolvedAlign {
  const data = col.align ?? 'left';
  return { data, header: col.headerAlign ?? data };
}

export function isColumnVisible<T>(col: ReportColumn<T>): boolean {
  if (col.visible === undefined) return true;
  return typeof col.visible === 'function' ? col.visible() : col.visible;
}

/** only these 2 of the 4 column kinds carry an `aggregate` field (see DataColumn/ComputedColumn above) */
export function isAggregatableColumn<T>(
  col: ReportColumn<T>,
): col is DataColumn<T> | ComputedColumn<T> {
  return col.type === 'data' || col.type === 'computed';
}
