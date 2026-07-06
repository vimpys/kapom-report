import type { Decimalish } from '../numeric/numeric-strategy';
import type { HAlign, NumberFormat, TextStyle } from './primitives';

export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type RowNumberMode = 'continuous' | 'per-group' | 'per-page';

interface ColumnBase {
  header: string;
  /** align ของ data cell; default 'left' */
  align?: HAlign;
  /** align ของ header cell; default = ค่า align */
  headerAlign?: HAlign;
  width?: number;
  headerStyle?: Partial<TextStyle>;
  cellStyle?: Partial<TextStyle>;
  /** ซ่อน/แสดงตามเงื่อนไข; default true */
  visible?: boolean | (() => boolean);
}

export interface DataColumn<T> extends ColumnBase {
  type: 'data';
  key: keyof T;
  numberFormat?: NumberFormat;
  /** engine รวมยอด column นี้ให้ใน group footer + summary อัตโนมัติ */
  aggregate?: AggregateFn | ((rows: readonly T[]) => Decimalish);
  formatter?: (value: T[keyof T], row: T) => string;
  /** render override — คืน string; conditional style ผ่าน resolver แยก */
  cellRenderer?: (value: T[keyof T], row: T) => string;
}

export interface RowNumberColumn extends ColumnBase {
  type: 'rowNumber';
  /** เริ่มนับจาก; default 1 */
  startAt?: number;
  /** continuous = ต่อทั้ง report, per-group = reset ทุกกลุ่ม, per-page = reset ทุกหน้า (two-pass) */
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

/** resolve alignment: header fallback → data, data fallback → 'left' */
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
