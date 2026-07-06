import type { jsPDF } from 'jspdf';

/** fallback when fontSize isn't provided — matches AutoTable's default and DEFAULT_TYPOGRAPHY.detailRow */
const AUTOTABLE_FONT_SIZE = 10;
/** left+right cellPadding, approximating AutoTable's default (5pt per side) in the doc's units */
function paddingAllowance(doc: jsPDF): number {
  return (2 * 5) / doc.internal.scaleFactor;
}

/**
 * Fixes a single set of column widths up front — necessary for a grouped table, where each
 * group is a separate autoTable (letting each one compute its own auto widths would make
 * columns misalign across groups).
 *
 * No need to distribute widths exactly like AutoTable's internal algorithm does —
 * as long as every segment uses the same set of values, the column lines stay aligned across the whole report;
 * text wider than what was measured, AutoTable wraps on its own (the row gets taller, it doesn't overflow)
 *
 * @param fontSize must match the fontSize the body actually uses (typography.detailRow once resolved —
 *   review fix #3: it used to be hardcoded to 10, which measured wrong whenever a user overrode typography)
 */
export function computeColumnWidths(
  doc: jsPDF,
  rows: readonly (readonly string[])[],
  userWidths: readonly (number | undefined)[],
  contentWidth: number,
  fontSize: number = AUTOTABLE_FONT_SIZE,
): number[] {
  const previousSize = doc.getFontSize();
  doc.setFontSize(fontSize);
  const pad = paddingAllowance(doc);

  const natural: number[] = [];
  for (let i = 0; i < userWidths.length; i += 1) {
    const user = userWidths[i];
    if (user !== undefined) {
      natural.push(user);
      continue;
    }
    let widest = 0;
    for (const row of rows) {
      const cell = row[i];
      if (cell === undefined || cell === '') continue;
      // a cell can have multiple lines — its natural width is the longest line
      for (const line of cell.split('\n')) {
        widest = Math.max(widest, doc.getTextWidth(line));
      }
    }
    natural.push(widest + pad);
  }
  doc.setFontSize(previousSize);

  // scale only the columns the user didn't fix, so the total fits contentWidth exactly (both
  // shrinking and stretching — AutoTable's default always stretches a table to full width,
  // so this keeps the look consistent with an ungrouped table)
  let fixedSum = 0;
  let flexSum = 0;
  natural.forEach((width, i) => {
    if (userWidths[i] !== undefined) fixedSum += width;
    else flexSum += width;
  });

  const targetFlex = contentWidth - fixedSum;
  if (flexSum <= 0 || targetFlex <= 0) return natural;

  const factor = targetFlex / flexSum;
  return natural.map((width, i) =>
    userWidths[i] !== undefined ? width : width * factor,
  );
}
