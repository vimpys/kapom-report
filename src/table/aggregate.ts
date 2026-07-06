import { KapomError } from '../core/errors';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { AggregateFn } from '../types/column';

/**
 * A cell value entering the calculation system must be Decimalish — data from the user is
 * unknown, so it must be narrowed + fail-fast at the boundary (never coerce silently, to prevent NaN from showing up in a total)
 */
export function asDecimalish(value: unknown, context: string): Decimalish {
  if (typeof value === 'number' || typeof value === 'string') return value;
  throw new KapomError(
    `${context}: aggregate requires a number|string value (got ${typeof value})`,
  );
}

/** all arithmetic goes through NumericStrategy per decision — never write a+b directly in this file */
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
