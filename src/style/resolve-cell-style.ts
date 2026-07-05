import type { CellStyle } from '../types/primitives';
import type { TableStyleOptions } from '../types/node';

/**
 * precedence (สูงไปต่ำ): conditional > zebra > row-type base
 * row-type base (Typography token) ทำไว้ก่อนแล้วนอกฟังก์ชันนี้ (bodyStyles ของ AutoTable)
 * ฟังก์ชันนี้คืนแค่ส่วนที่ override ทับ — merge ทับ cell.styles ใน didParseCell
 */
export function resolveRowStyle<T>(
  options: TableStyleOptions<T> | undefined,
  row: T,
  rowIndex: number,
): Partial<CellStyle> {
  if (!options) return {};

  const zebra = options.zebra;
  const zebraColor = zebra ? (rowIndex % 2 === 0 ? zebra.even : zebra.odd) : undefined;
  const zebraStyle: Partial<CellStyle> = zebraColor ? { fillColor: zebraColor } : {};

  const conditionalStyle = options.conditional?.(row, rowIndex) ?? {};

  return { ...zebraStyle, ...conditionalStyle };
}
