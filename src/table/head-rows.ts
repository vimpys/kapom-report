import type { CellDef, RowInput, Styles } from 'jspdf-autotable';
import { KapomError } from '../core/errors';
import { normalizeText } from '../core/text-normalizer';
import type { ReportColumn, TableColumn } from '../types/column';
import { columnDepth, flattenColumns, isColumnGroup, isColumnVisible, normalizeColumn, resolveColumnAlign } from '../types/column';
import { cellStyleToAutoTableStyles } from './autotable-styles';

/** inline styles for a leaf head cell (halign + per-column headerStyle) — used in the 2-row grouped head, where cellHook skips object cells */
function headCellStyles<T>(col: ReportColumn<T>): Partial<Styles> {
  return {
    halign: resolveColumnAlign(col).header,
    ...cellStyleToAutoTableStyles(col.headerStyle),
  };
}

/**
 * The head as AutoTable rows — a single row of leaf headers normally, or a multi-row header when
 * any top-level column is a group (nested to any depth). Built recursively: a group's `header`
 * gets `colSpan` = its visible-leaf count and sits on its own depth's row; a leaf's header gets
 * `rowSpan` = the rows remaining below it (so it stretches to the bottom, vertically centered).
 * Grouped-head cells carry their own inline styles, so cellHook skips styling any object head cell.
 */
export function buildHeadRows<T>(columns: readonly TableColumn<T>[]): RowInput[] {
  const topColumns = columns.filter((col) => isColumnGroup(col) || isColumnVisible(col));

  if (!topColumns.some(isColumnGroup)) {
    // single row of plain strings — cellHook applies alignment (backward-compatible path unchanged)
    return [flattenColumns(topColumns).filter(isColumnVisible).map((col) => normalizeText(col.header))];
  }

  const totalRows = Math.max(...topColumns.map(columnDepth));
  const rows: CellDef[][] = Array.from({ length: totalRows }, () => []);
  const rowAt = (index: number): CellDef[] => {
    const row = rows[index];
    if (!row) throw new KapomError(`buildHeadRows: header row ${index} is out of range`);
    return row;
  };

  const place = (col: TableColumn<T>, depth: number): void => {
    if (isColumnGroup(col)) {
      const leaves = flattenColumns(col.columns).filter(isColumnVisible);
      if (leaves.length === 0) return;
      rowAt(depth).push({
        content: normalizeText(col.header),
        colSpan: leaves.length,
        styles: { halign: col.headerAlign ?? 'center', valign: 'middle' },
      });
      for (const child of col.columns) place(child, depth + 1);
    } else if (isColumnVisible(col)) {
      const leaf = normalizeColumn(col); // shorthand → data, so headCellStyles/resolveColumnAlign work
      // a leaf stretches from its own row down to the bottom (rowSpan) → vertically centered
      rowAt(depth).push({
        content: normalizeText(leaf.header),
        rowSpan: totalRows - depth,
        styles: { ...headCellStyles(leaf), valign: 'middle' },
      });
    }
  };

  for (const col of topColumns) place(col, 0);
  return rows;
}
