import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomError, KapomLayoutError } from '../core/errors';
import { deriveMeasureContext } from '../core/measure-context';
import type { ReportNodeInput, RowNode } from '../types/node';
import { resolveNodeInput } from '../types/node';

/** default horizontal gap between columns (mm) — enough that adjacent text columns don't touch */
export const DEFAULT_ROW_GAP = 4;

/** a resolved column box, relative to the row's left edge */
export interface ResolvedRowColumn {
  x: number;
  width: number;
}

/**
 * Pure width resolution: fixed widths are taken as-is, the remaining space (after fixed widths
 * and gaps) is split equally among the flexible (width omitted) columns — throws KapomLayoutError
 * when the fixed widths + gaps don't leave room (fail-fast instead of drawing overlapping columns).
 */
export function resolveRowColumnWidths(
  widths: readonly (number | undefined)[],
  contentWidth: number,
  gap: number,
): ResolvedRowColumn[] {
  const gapTotal = gap * (widths.length - 1);
  const fixedTotal = widths.reduce<number>((sum, w) => sum + (w ?? 0), 0);
  const flexCount = widths.filter((w) => w === undefined).length;
  const flexSpace = contentWidth - fixedTotal - gapTotal;

  if (flexCount > 0 && flexSpace <= 0) {
    throw new KapomLayoutError(
      `row: fixed column widths + gaps (${(fixedTotal + gapTotal).toFixed(2)}) leave no room for the flexible columns within contentWidth ${contentWidth.toFixed(2)}`,
    );
  }
  if (flexCount === 0 && fixedTotal + gapTotal > contentWidth) {
    throw new KapomLayoutError(
      `row: fixed column widths + gaps (${(fixedTotal + gapTotal).toFixed(2)}) exceed contentWidth ${contentWidth.toFixed(2)}`,
    );
  }

  const flexWidth = flexCount > 0 ? flexSpace / flexCount : 0;
  const resolved: ResolvedRowColumn[] = [];
  let x = 0;
  for (const w of widths) {
    const width = w ?? flexWidth;
    resolved.push({ x, width });
    x += width + gap;
  }
  return resolved;
}

/**
 * v1 scope guard: a row is a keep-together unit rendered inside a fixed box — children that
 * paginate themselves (table syncs the cursor across pages) or force page-breaks (section)
 * can't work inside it, so reject them fail-fast at build time instead of failing mid-render.
 * Walks nested stack/row children too, since the restriction is about what ends up rendering.
 */
export function assertRowChildAllowed(input: ReportNodeInput<unknown>): void {
  const node = resolveNodeInput(input);
  if (node.type === 'table' || node.type === 'section') {
    throw new KapomError(
      `row: a '${node.type}' block is not supported inside a row column (v1) — it paginates or breaks pages itself, which conflicts with the row's keep-together box`,
    );
  }
  if (node.type === 'stack') {
    for (const child of node.children) assertRowChildAllowed(child);
  }
  if (node.type === 'row') {
    for (const column of node.columns) {
      for (const child of column.children) assertRowChildAllowed(child);
    }
  }
}

/** validate the node shape (fail-fast at build time, same convention as registerBlockType/SignatureBlock) */
export function assertRowNodeValid(node: RowNode<unknown>): void {
  if (node.columns.length === 0) {
    throw new KapomError('row: columns must not be empty');
  }
  for (const column of node.columns) {
    if (column.width !== undefined && (!Number.isFinite(column.width) || column.width <= 0)) {
      throw new KapomLayoutError(`row: column width must be > 0 (got ${column.width})`);
    }
    for (const child of column.children) assertRowChildAllowed(child);
  }
  if (node.gap !== undefined && (!Number.isFinite(node.gap) || node.gap < 0)) {
    throw new KapomLayoutError(`row: gap must be >= 0 (got ${node.gap})`);
  }
}

/** a column after the factory built its children — width config + the child blocks to stack */
export interface RowBlockColumn {
  readonly width: number | undefined;
  readonly blocks: readonly MeasurableBlock[];
}

/**
 * Horizontal composite — the row reserves its full height up front (ctx.ensureSpace, keep-together)
 * then renders every column's children into a per-column sub-context whose cursor/advanceY are
 * detached from the engine's real cursor: each column starts back at the row's top edge, which the
 * real cursor can't do (PdfCursor.syncTo never goes backwards). The real cursor advances exactly
 * once, by the tallest column's height.
 */
export class RowBlock implements MeasurableBlock {
  constructor(
    private readonly columns: readonly RowBlockColumn[],
    private readonly gap: number,
  ) {}

  measureHeight(ctx: MeasureContext): number {
    const resolved = resolveRowColumnWidths(
      this.columns.map((c) => c.width),
      ctx.contentWidth,
      this.gap,
    );
    return Math.max(
      0,
      ...this.columns.map((column, i) => this.columnHeight(ctx, column, resolved[i]?.width ?? 0)),
    );
  }

  render(ctx: RenderContext): void {
    const measureCtx = deriveMeasureContext(ctx);
    const resolved = resolveRowColumnWidths(
      this.columns.map((c) => c.width),
      ctx.contentWidth,
      this.gap,
    );
    const rowHeight = Math.max(
      0,
      ...this.columns.map((column, i) => this.columnHeight(measureCtx, column, resolved[i]?.width ?? 0)),
    );

    ctx.ensureSpace(rowHeight);
    const top = ctx.cursor.y;
    const left = ctx.margins.left; // margins.left (not cursor.x) follows an indent override, same lesson as drawGroupBand

    this.columns.forEach((column, i) => {
      const box = resolved[i];
      if (!box) return;
      const columnCtx = buildColumnContext(ctx, left + box.x, box.width, top);
      for (const block of column.blocks) {
        block.render(columnCtx);
      }
    });

    ctx.advanceY(rowHeight);
  }

  private columnHeight(ctx: MeasureContext, column: RowBlockColumn, width: number): number {
    const columnCtx: MeasureContext = { ...ctx, contentWidth: width };
    return column.blocks.reduce((sum, block) => sum + block.measureHeight(columnCtx), 0);
  }
}

/**
 * A RenderContext confined to one column's box: cursor.x pinned to the column's left edge,
 * cursor.y tracked locally from the row's top (advanceY moves only this column), margins/
 * contentWidth describe the column. ensureSpace is a no-op — the row already reserved its full
 * height. syncCursor/forcePageBreak throw (their callers are rejected at build time anyway).
 */
function buildColumnContext(
  ctx: RenderContext,
  columnX: number,
  columnWidth: number,
  top: number,
): RenderContext {
  const pageWidth = ctx.margins.left + ctx.contentWidth + ctx.margins.right;
  const state = { y: top };
  return {
    ...ctx,
    cursor: {
      get x() {
        return columnX;
      },
      get y() {
        return state.y;
      },
      get pageIndex() {
        return ctx.cursor.pageIndex;
      },
    },
    margins: {
      ...ctx.margins,
      left: columnX,
      right: pageWidth - columnX - columnWidth,
    },
    contentWidth: columnWidth,
    advanceY: (amount) => {
      state.y += amount;
    },
    ensureSpace: () => {
      /* no-op — the row reserved its full height before any column rendered */
    },
    syncCursor: () => {
      throw new KapomLayoutError('row: a block that paginates itself cannot render inside a row column');
    },
    forcePageBreak: () => {
      throw new KapomLayoutError('row: forcePageBreak is not supported inside a row column');
    },
  };
}
