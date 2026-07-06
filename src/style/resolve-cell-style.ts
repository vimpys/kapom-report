import type { CellStyle } from '../types/primitives';
import type { TableStyleOptions } from '../types/node';

/**
 * precedence (highest to lowest): conditional > zebra > row-type base
 * the row-type base (a Typography token) is already handled outside this function (AutoTable's bodyStyles)
 * this function returns only the override portion — merged over cell.styles in didParseCell
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
