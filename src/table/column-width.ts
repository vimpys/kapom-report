import type { jsPDF } from 'jspdf';
import { KapomLayoutError } from '../core/errors';
import { sum } from '../core/layout-math';

/** fallback when fontSize isn't provided — matches AutoTable's default and DEFAULT_TYPOGRAPHY.detailRow */
const AUTOTABLE_FONT_SIZE = 10;

/** trims float noise so an error reads "180" rather than "179.99999999999997" */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fail fast when the widths a user pinned on their columns cannot fit the content area.
 *
 * Nothing checked this before: the scaling below only stretches or shrinks the *auto* columns, so
 * once the fixed ones alone filled the page there was no room left to give and the table was
 * simply drawn past the right margin — no error from us, none from AutoTable either. Silent
 * overflow is the exact failure mode this library exists to remove, and the fix is always the
 * user's to make (drop a width, widen the page, switch to landscape), so it has to be reported.
 *
 * Fixed widths that exactly fill the content area are fine when every column is fixed, and an
 * error when they are not — an auto column with zero space left cannot render.
 */
export function assertFixedWidthsFit(
  userWidths: readonly (number | undefined)[],
  contentWidth: number,
): void {
  const fixed = userWidths.filter((width): width is number => width !== undefined);
  if (fixed.length === 0) return;

  const fixedSum = sum(fixed);
  const autoCount = userWidths.length - fixed.length;
  const overflows = autoCount > 0 ? fixedSum >= contentWidth : fixedSum > contentWidth;
  if (!overflows) return;

  throw new KapomLayoutError(
    `column widths don't fit: ${fixed.length} fixed width(s) (${fixed.map(round).join(' + ')}) ` +
      `total ${round(fixedSum)} but the content area is only ${round(contentWidth)} wide` +
      (autoCount > 0 ? `, and ${autoCount} auto-width column(s) still need room` : '') +
      `. Reduce the widths, widen the page (or use landscape/wider margins), or leave more columns auto.`,
  );
}
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
  assertFixedWidthsFit(userWidths, contentWidth);

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

  // every column fixed → nothing to scale; use them as given (they fit, per the assert above)
  if (flexSum <= 0) return natural;

  // guaranteed positive: with at least one auto column the assert rejected fixedSum >= contentWidth
  const targetFlex = contentWidth - fixedSum;
  const factor = targetFlex / flexSum;
  return natural.map((width, i) =>
    userWidths[i] !== undefined ? width : width * factor,
  );
}
