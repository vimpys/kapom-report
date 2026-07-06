/**
 * The value type accepted by the calculation system — a number or a string (from a DB's
 * DECIMAL column). mysql2/pg return DECIMAL as a string to preserve precision → accepted as-is, never converted to number.
 */
export type Decimalish = number | string;

/**
 * The boundary for all arithmetic in Kapom Report.
 * Never write `a + b` directly in aggregate/computed/runningTotal — it must go through this strategy.
 * The MVP uses nativeNumeric; migrating to decimal.js later won't need to touch the calling logic.
 */
export interface NumericStrategy {
  add(a: Decimalish, b: Decimalish): Decimalish;
  subtract(a: Decimalish, b: Decimalish): Decimalish;
  multiply(a: Decimalish, b: Decimalish): Decimalish;
  divide(a: Decimalish, b: Decimalish): Decimalish;
  sum(values: readonly Decimalish[]): Decimalish;
  /** converts to a number, for jsPDF/Intl.NumberFormat at the very last point */
  toNumber(value: Decimalish): number;
}

const toNum = (value: Decimalish): number =>
  typeof value === 'number' ? value : Number(value);

export const nativeNumeric: NumericStrategy = {
  add: (a, b) => toNum(a) + toNum(b),
  subtract: (a, b) => toNum(a) - toNum(b),
  multiply: (a, b) => toNum(a) * toNum(b),
  divide: (a, b) => toNum(a) / toNum(b),
  sum: (values) => values.reduce<number>((acc, v) => acc + toNum(v), 0),
  toNumber: toNum,
} as const;
