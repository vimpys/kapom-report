import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { NumberFormat } from '../types/primitives';

/** default per decision: th-TH, 2 decimal places — overridable at the report → column level */
export const DEFAULT_NUMBER_FORMAT: Required<NumberFormat> = {
  locale: 'th-TH',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/** Intl.NumberFormat is expensive to construct — cached per config, since a 100+ page report formats hundreds of thousands of times */
const formatterCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(format?: NumberFormat): Intl.NumberFormat {
  const resolved: Required<NumberFormat> = { ...DEFAULT_NUMBER_FORMAT, ...format };
  const key = `${resolved.locale}|${resolved.minimumFractionDigits}|${resolved.maximumFractionDigits}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(resolved.locale, {
      minimumFractionDigits: resolved.minimumFractionDigits,
      maximumFractionDigits: resolved.maximumFractionDigits,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Display rounding is separate from calculation — toNumber happens only at the final point
 * before display, trimming float artifacts (7.7000...1) on the report page even while still using nativeNumeric
 */
export function formatNumber(
  value: Decimalish,
  numeric: NumericStrategy,
  format?: NumberFormat,
): string {
  return getNumberFormatter(format).format(numeric.toNumber(value));
}
