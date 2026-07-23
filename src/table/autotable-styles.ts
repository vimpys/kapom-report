import type { CellDef, Styles } from 'jspdf-autotable';
import type { ResolvedAlign } from '../types/column';
import type { CellStyle, TextStyle } from '../types/primitives';

/**
 * Lay a row of `values` across `gridCols` columns — the last cell colSpans to fill any shortfall.
 * Used by nestedLayout 'stacked' to stack a K-column master row and an M-column child row in one
 * shared grid (gridCols = max(K, M)); the shorter side's last cell simply spans the extra columns.
 */
export function fitRowToGrid(
  values: readonly string[],
  aligns: readonly ResolvedAlign[],
  which: keyof ResolvedAlign, // 'header' for a label row, 'data' for a values row
  gridCols: number,
  extra?: Partial<Styles>,
): CellDef[] {
  return values.map((content, idx) => {
    const isLast = idx === values.length - 1;
    const colSpan = isLast ? gridCols - (values.length - 1) : 1;
    const halign = aligns[idx]?.[which] ?? 'left';
    return { content, colSpan, styles: { halign, ...(extra ?? {}) } };
  });
}

/** CellStyle (zebra/conditional override, column headerStyle/cellStyle) → AutoTable Partial<Styles> */
export function cellStyleToAutoTableStyles(style: Partial<CellStyle> | undefined): Partial<Styles> {
  if (!style) return {};
  const styles: Partial<Styles> = {};
  if (style.fillColor) styles.fillColor = [...style.fillColor];
  if (style.textColor) styles.textColor = [...style.textColor];
  if (style.fontStyle) styles.fontStyle = style.fontStyle;
  if (style.fontSize !== undefined) styles.fontSize = style.fontSize;
  if (style.halign) styles.halign = style.halign;
  return styles;
}

/** extracts a string from an AutoTable cell — handles both a plain string and a CellDef object ({content}, e.g. the no-data colSpan row) */
export function cellStringContent(cell: unknown): string | undefined {
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'object' && cell !== null && 'content' in cell) {
    const { content } = cell as { content?: unknown };
    if (typeof content === 'string') return content;
  }
  return undefined;
}

/**
 * Merges an aggregate row's label cell with any immediately-following empty columns into one
 * wider colSpan cell — purely a display concern (the flat `foot` array is still what's used for
 * column-width measurement and GroupTreeNode.foot, both untouched by this). Gives the label room
 * instead of squeezing into a single narrow column (e.g. a rowNumber column, see demo 03) and
 * forces left-align, since a merged cell is now a text label, not whatever alignment the
 * underlying columns (e.g. right-aligned rowNumber) would otherwise use.
 */
export function mergeFootLabel(foot: readonly string[], labelIndex: number): (string | CellDef)[] {
  if (labelIndex === -1) return [...foot];
  let span = 1;
  while (labelIndex + span < foot.length && foot[labelIndex + span] === '') span += 1;
  if (span === 1) return [...foot];

  return [
    ...foot.slice(0, labelIndex),
    { content: foot[labelIndex] ?? '', colSpan: span, styles: { halign: 'left' } },
    ...foot.slice(labelIndex + span),
  ];
}

/** TextStyle (a Typography token) → AutoTable Partial<Styles> — font family isn't set unless specified (inherits from the base styles.font instead) */
export function partialTextStyleToAutoTableStyles(style: Partial<TextStyle> | undefined): Partial<Styles> {
  if (!style) return {};
  const styles: Partial<Styles> = {};
  if (style.fontSize !== undefined) styles.fontSize = style.fontSize;
  if (style.fontStyle) styles.fontStyle = style.fontStyle;
  if (style.color) styles.textColor = [...style.color];
  if (style.fontFamily) styles.font = style.fontFamily;
  return styles;
}
