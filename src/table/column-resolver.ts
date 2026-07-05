import { KapomError } from '../core/errors';
import { formatNumber } from '../format/number-format';
import { computeAggregate } from './aggregate';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { ReportColumn, ResolvedAlign } from '../types/column';
import { isColumnVisible, resolveColumnAlign } from '../types/column';
import type { TableNode } from '../types/node';

/** default label ของ summary row — สอดคล้อง default locale th-TH */
export const DEFAULT_SUMMARY_LABEL = 'รวม';

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

function stringifyCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export function resolveTableContent<T>(
  node: TableNode<T>,
  numeric: NumericStrategy,
): ResolvedTableContent {
  const columns = node.columns.filter(isColumnVisible);
  if (columns.length === 0) {
    throw new KapomError('table ต้องมี column ที่ visible อย่างน้อย 1 ตัว');
  }

  const aligns = columns.map(resolveColumnAlign);
  const widths = columns.map((col) => col.width);
  const head = columns.map((col) => col.header);

  // state ต่อ column สำหรับ runningTotal — สะสมตาม render order จริง
  const runningTotals: (Decimalish | undefined)[] = columns.map(() => undefined);

  const body = node.data.map((row, rowIndex) =>
    columns.map((col, colIndex) =>
      resolveCell(col, row, rowIndex, colIndex, runningTotals, numeric),
    ),
  );

  return { head, body, foot: resolveFoot(columns, node, numeric), aligns, widths };
}

function resolveCell<T>(
  col: ReportColumn<T>,
  row: T,
  rowIndex: number,
  colIndex: number,
  runningTotals: (Decimalish | undefined)[],
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
      if (mode !== 'continuous') {
        // per-group มากับ group block (ขั้น 3), per-page ต้อง two-pass (ขั้น 7)
        throw new KapomError(`rowNumber mode '${mode}' ยังไม่รองรับ — MVP มีเฉพาะ 'continuous'`);
      }
      const n = (col.startAt ?? 1) + rowIndex;
      return col.formatter ? col.formatter(n) : String(n);
    }
    case 'computed': {
      const value = col.compute(row);
      if (col.formatter) return col.formatter(value, row);
      // computed เป็น numeric โดย contract (คืน Decimalish) → format เสมอ (default th-TH)
      return formatNumber(value, numeric, col.numberFormat);
    }
    case 'runningTotal': {
      const mode = col.mode ?? 'continuous';
      if (mode !== 'continuous') {
        throw new KapomError(`runningTotal mode '${mode}' ยังไม่รองรับ — MVP มีเฉพาะ 'continuous'`);
      }
      const previous = runningTotals[colIndex] ?? 0;
      const accumulated = numeric.add(previous, col.valueOf(row));
      runningTotals[colIndex] = accumulated;
      return col.formatter ? col.formatter(accumulated) : formatNumber(accumulated, numeric, col.numberFormat);
    }
  }
}

function asDecimalishCell(value: unknown, columnHeader: string): Decimalish {
  if (typeof value === 'number' || typeof value === 'string') return value;
  throw new KapomError(
    `column '${columnHeader}': numberFormat ต้องการค่า number|string แต่ได้ ${typeof value}`,
  );
}

function resolveFoot<T>(
  columns: readonly ReportColumn<T>[],
  node: TableNode<T>,
  numeric: NumericStrategy,
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
      return formatNumber(col.aggregate(node.data), numeric, col.numberFormat);
    }

    const values =
      col.type === 'data'
        ? node.data.map((row) => asDecimalishCell(row[col.key], col.header))
        : node.data.map((row) => col.compute(row));

    const result = computeAggregate(col.aggregate, values, numeric);
    // count เป็นจำนวนเต็มเสมอ — format ทศนิยม 2 ตำแหน่งจะอ่านแปลก (เช่น "3.00")
    return col.aggregate === 'count'
      ? String(result)
      : formatNumber(result, numeric, col.numberFormat);
  });

  const first = foot[0];
  if (first === '') foot[0] = node.summaryLabel ?? DEFAULT_SUMMARY_LABEL;
  return foot;
}
