import { KapomError } from '../core/errors';
import { normalizeText } from '../core/text-normalizer';
import { formatNumber } from '../format/number-format';
import { computeAggregate } from './aggregate';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { ReportColumn, ResolvedAlign } from '../types/column';
import { isColumnVisible, resolveColumnAlign } from '../types/column';
import type { TableNode } from '../types/node';

/** default label ของ summary row — สอดคล้อง default locale th-TH */
export const DEFAULT_SUMMARY_LABEL = 'รวม';

/** default ข้อความ No-Data fallback (`data: []`) — สอดคล้อง default locale th-TH เหมือน DEFAULT_SUMMARY_LABEL */
export const DEFAULT_NO_DATA_TEXT = 'ไม่มีข้อมูล';

/**
 * ผลลัพธ์ pure จาก column system — string ล้วนพร้อมส่งเข้า AutoTable
 * แยกจาก jsPDF ทั้งหมดเพื่อ test aggregate/format/derived column ได้ตรงๆ
 */
export interface ResolvedTableContent {
  head: string[];
  body: string[][];
  /** undefined เมื่อไม่มี column ไหนประกาศ aggregate */
  foot: string[] | undefined;
  aligns: ResolvedAlign[];
  widths: (number | undefined)[];
}

/**
 * state ที่ไหลข้าม segment (กลุ่ม) — mode 'continuous' อ่าน/สะสมผ่านตัวนี้
 * grouped table สร้างครั้งเดียวแล้วส่งเข้า resolveSegmentBody ทีละกลุ่มตามลำดับ render
 */
export interface SegmentState {
  /** จำนวนแถวที่ resolve ไปแล้วก่อน segment นี้ (ฐานของ rowNumber continuous) */
  rowOffset: number;
  /** ยอดสะสมต่อ column index (runningTotal continuous) */
  runningTotals: (Decimalish | undefined)[];
}

export function createSegmentState(columnCount: number): SegmentState {
  return {
    rowOffset: 0,
    runningTotals: Array.from({ length: columnCount }, () => undefined),
  };
}

/** filter ตาม visible + fail-fast ถ้าไม่เหลือ column เลย */
export function visibleColumns<T>(
  columns: readonly ReportColumn<T>[],
): ReportColumn<T>[] {
  const visible = columns.filter(isColumnVisible);
  if (visible.length === 0) {
    throw new KapomError('table ต้องมี column ที่ visible อย่างน้อย 1 ตัว');
  }
  return visible;
}

function stringifyCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function asDecimalishCell(value: unknown, columnHeader: string): Decimalish {
  if (typeof value === 'number' || typeof value === 'string') return value;
  throw new KapomError(
    `column '${columnHeader}': numberFormat ต้องการค่า number|string แต่ได้ ${typeof value}`,
  );
}

/**
 * resolve body ของหนึ่ง segment (ทั้งตารางเมื่อไม่ group, หนึ่งกลุ่มเมื่อ group)
 * mutate state: per-group accumulator ถูก reset ที่หัว segment, rowOffset เลื่อนตอนจบ
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
        // per-page ต้องรู้ page break จริง → two-pass (roadmap ขั้น 7)
        throw new KapomError(`rowNumber mode 'per-page' ยังไม่รองรับ — ต้องรอ two-pass (ขั้น 7)`);
      }
      const base = mode === 'continuous' ? state.rowOffset : 0;
      const n = (col.startAt ?? 1) + base + localIndex;
      return col.formatter ? col.formatter(n) : String(n);
    }
    case 'computed': {
      const value = col.compute(row);
      if (col.formatter) return col.formatter(value, row);
      // computed เป็น numeric โดย contract (คืน Decimalish) → format เสมอ (default th-TH)
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

/**
 * แถว aggregate (group footer / grand total) — label ลง "cell แรกที่ว่าง" (ค้างแก้ #4:
 * เดิมเช็คแค่ foot[0] ทำให้ label หายเงียบถ้าคอลัมน์แรกมี aggregate); ถ้าทุก cell
 * มีค่าหมด (ทุกคอลัมน์ aggregate) label ถูกละไว้ — ไม่มีที่ให้ลงโดยไม่ทับยอด
 * คืน undefined เมื่อไม่มี column ไหนประกาศ aggregate
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
      // custom aggregate fn มีเฉพาะ DataColumn (ดู types/column.ts)
      return formatNumber(col.aggregate(rows), numeric, col.numberFormat);
    }

    const values =
      col.type === 'data'
        ? rows.map((row) => asDecimalishCell(row[col.key], col.header))
        : rows.map((row) => col.compute(row));

    const result = computeAggregate(col.aggregate, values, numeric);
    // count เป็นจำนวนเต็มเสมอ — format ทศนิยม 2 ตำแหน่งจะอ่านแปลก (เช่น "3.00")
    return col.aggregate === 'count'
      ? String(result)
      : formatNumber(result, numeric, col.numberFormat);
  });

  const firstEmpty = foot.findIndex((cell) => cell === '');
  if (firstEmpty !== -1) foot[firstEmpty] = label;
  return foot.map((cell) => normalizeText(cell));
}

/** ตารางไม่ group = segment เดียว — mode per-group จึงเท่ากับ continuous โดยธรรมชาติ */
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
