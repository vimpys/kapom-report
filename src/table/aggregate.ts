import { KapomError } from '../core/errors';
import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { AggregateFn } from '../types/column';

/**
 * How a Decimalish would actually be read by the arithmetic below (nativeNumeric's `Number(v)`),
 * except that a blank string maps to NaN rather than 0 — `Number('')` is 0, which would let a
 * missing value quietly count as a real zero in a total instead of being reported.
 */
function toFiniteNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  return value.trim() === '' ? Number.NaN : Number(value);
}

/**
 * A cell value entering the calculation system must be Decimalish — data from the user is
 * unknown, so it must be narrowed + fail-fast at the boundary (never coerce silently, to prevent
 * NaN from showing up in a total).
 *
 * The type check alone wasn't enough: `Decimalish` allows any string (mysql2/pg hand back DECIMAL
 * columns as strings), so 'N/A' or a pre-formatted '1,234.00' passed the guard and then surfaced
 * on the page as a literal "NaN", and '' silently became 0. Both are data bugs that are far more
 * expensive to find in a printed 100-page report than at the boundary, so the value has to parse
 * to a finite number here too.
 */
/**
 * Whether a value would survive the asDecimalish boundary below — i.e. it is arithmetic-safe.
 * Lets a caller branch on a bad value instead of throwing, for the one input that isn't data
 * from the user's data source: a custom aggregate function's return value (see resolveAggregateRow).
 */
export function isFiniteDecimalish(value: unknown): value is Decimalish {
  return (typeof value === 'number' || typeof value === 'string') && Number.isFinite(toFiniteNumber(value));
}

export function asDecimalish(value: unknown, context: string): Decimalish {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new KapomError(
      `${context}: expected a number or a numeric string (got ${typeof value})`,
    );
  }

  if (!Number.isFinite(toFiniteNumber(value))) {
    throw new KapomError(
      `${context}: ${JSON.stringify(value)} is not a finite number — it would print as "NaN" ` +
        `(a blank string would silently count as 0). Clean the data first: map null/blank to 0, ` +
        `and strip any formatting such as thousands separators or a currency symbol.`,
    );
  }

  return value;
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
