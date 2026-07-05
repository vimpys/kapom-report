import { KapomError } from '../core/errors';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { AggregateFn } from '../types/column';

/**
 * ค่าใน cell ที่จะเข้าระบบคำนวณต้องเป็น Decimalish — data จาก user เป็น unknown
 * ที่ boundary จึงต้อง narrow + fail-fast (ห้าม coerce เงียบ กัน NaN โผล่ใน total)
 */
export function asDecimalish(value: unknown, context: string): Decimalish {
  if (typeof value === 'number' || typeof value === 'string') return value;
  throw new KapomError(
    `${context}: aggregate ต้องการค่า number|string แต่ได้ ${typeof value}`,
  );
}

/** arithmetic ทุกจุดผ่าน NumericStrategy ตาม decision — ห้าม a+b ตรงในไฟล์นี้ */
export function computeAggregate(
  fn: AggregateFn,
  values: readonly Decimalish[],
  numeric: NumericStrategy,
): Decimalish {
  switch (fn) {
    case 'count':
      return values.length;
    case 'sum':
      return numeric.sum(values);
    case 'avg':
      return values.length === 0 ? 0 : numeric.divide(numeric.sum(values), values.length);
    case 'min':
    case 'max': {
      if (values.length === 0) return 0;
      const better = fn === 'min' ? (a: number, b: number) => a < b : (a: number, b: number) => a > b;
      return values.reduce((best, v) =>
        better(numeric.toNumber(v), numeric.toNumber(best)) ? v : best,
      );
    }
  }
}
