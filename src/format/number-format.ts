import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { NumberFormat } from '../types/primitives';

/** default per decision: th-TH, 2 decimal places — overridable at the report → column level */
export const DEFAULT_NUMBER_FORMAT: Required<Omit<NumberFormat, 'fractionDigits'>> = {
  locale: 'th-TH',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

interface ResolvedNumberFormat {
  locale: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
}

function resolveNumberFormat(format?: NumberFormat): ResolvedNumberFormat {
  return {
    locale: format?.locale ?? DEFAULT_NUMBER_FORMAT.locale,
    minimumFractionDigits:
      format?.minimumFractionDigits ?? format?.fractionDigits ?? DEFAULT_NUMBER_FORMAT.minimumFractionDigits,
    maximumFractionDigits:
      format?.maximumFractionDigits ?? format?.fractionDigits ?? DEFAULT_NUMBER_FORMAT.maximumFractionDigits,
  };
}

/** Intl.NumberFormat is expensive to construct — cached per config, since a 100+ page report formats hundreds of thousands of times */
const formatterCache = new Map<string, Intl.NumberFormat>();

function formatterFor(resolved: ResolvedNumberFormat): Intl.NumberFormat {
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

export function getNumberFormatter(format?: NumberFormat): Intl.NumberFormat {
  return formatterFor(resolveNumberFormat(format));
}

/**
 * How many decimal places past the ones actually shown are kept when snapping off float noise.
 * Six is far more than any rounding decision needs and far less than where a double starts
 * inventing digits, so the snap can only ever move a value that was already wrong.
 */
const FLOAT_NOISE_GUARD_DIGITS = 6;

/**
 * Binary floating point lands a hair below the value a person computes by hand: `3 × 1.115` is
 * 3.3449999999999998 rather than 3.345, so Intl rounds it to "3.34" while every hand calculation
 * and every spreadsheet says "3.35". Rounding to a few more decimal places than will be displayed
 * absorbs that, and cannot touch a digit the caller asked to see.
 *
 * Deliberately by decimal places and not by significant digits: significant digits would eat the
 * *integer* part of a large value — a real amount like 12,345,678,901.23 came back as
 * 12,345,678,901.20 when tried that way, which is far worse than the problem being fixed. Scaling
 * off maximumFractionDigits also makes this a no-op once a caller asks for precision near what a
 * double can hold, so nobody chasing real precision is second-guessed.
 *
 * This is display hygiene, not arithmetic: it runs at the last step before Intl and never touches
 * a stored value or anything NumericStrategy computed. Exact arithmetic is still the job of a
 * NumericStrategy backed by a decimal library (see `numeric`).
 */
function snapFloatNoise(value: number, maximumFractionDigits: number): number {
  const digits = maximumFractionDigits + FLOAT_NOISE_GUARD_DIGITS;
  // toFixed only accepts 0–100, and a non-finite value has no noise to snap
  if (!Number.isFinite(value) || digits > 100) return value;
  return Number(value.toFixed(digits));
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
  const resolved = resolveNumberFormat(format);
  return formatterFor(resolved).format(
    snapFloatNoise(numeric.toNumber(value), resolved.maximumFractionDigits),
  );
}
