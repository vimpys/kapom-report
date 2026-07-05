import type { Decimalish, NumericStrategy } from '../numeric/numeric-strategy';
import type { NumberFormat } from '../types/primitives';

/** default ตาม decision: th-TH ทศนิยม 2 ตำแหน่ง — override ได้ระดับ report → column */
export const DEFAULT_NUMBER_FORMAT: Required<NumberFormat> = {
  locale: 'th-TH',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/** Intl.NumberFormat สร้างแพง — cache ต่อ config เพราะ report 100+ หน้า format เป็นแสนครั้ง */
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
 * display rounding แยกจาก calculation — toNumber เฉพาะจุดสุดท้ายก่อนแสดงผล
 * ตัด float artifact (7.7000...1) บนหน้า report แม้ยังใช้ nativeNumeric
 */
export function formatNumber(
  value: Decimalish,
  numeric: NumericStrategy,
  format?: NumberFormat,
): string {
  return getNumberFormatter(format).format(numeric.toNumber(value));
}
