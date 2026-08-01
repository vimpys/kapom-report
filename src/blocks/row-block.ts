import { buildConfinedContext } from '../core/confined-context';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomError, KapomLayoutError } from '../core/errors';
import { deriveMeasureContext, measureBlocksHeight } from '../core/measure-context';
import type { ReportNodeInput, RowNode } from '../types/node';
import { resolveNodeInput } from '../types/node';

/** default horizontal gap between columns (mm) — enough that adjacent text columns don't touch */
export const DEFAULT_ROW_GAP = 4;

/** a resolved column box, relative to the row's left edge */
interface ResolvedRowColumn {
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
 * Scope guard shared by the confined composites (row column / box): children render inside a
 * fixed reserved box, so blocks that paginate themselves (table syncs the cursor across pages)
 * or force page-breaks (section) can't work inside — reject them fail-fast at build time instead
 * of failing mid-render. Walks nested stack/row/box children too, since the restriction is about
 * what ends up rendering.
 */
export function assertConfinedChildAllowed(input: ReportNodeInput<unknown>, container: string): void {
  const node = resolveNodeInput(input);
  if (node.type === 'table' || node.type === 'section' || node.type === 'pageBreak') {
    throw new KapomError(
      `${container}: a '${node.type}' block is not supported inside a ${container} (v1) — it paginates or breaks pages itself, which conflicts with the reserved box it would render into`,
    );
  }

  if (node.type === 'bottomAnchor') {
    throw new KapomError(
      `${container}: a 'bottomAnchor' block is not supported inside a ${container} — it pins to the page bottom (contentBottom), which has no meaning inside a fixed zone; use it at the top level`,
    );
  }

  if (node.type === 'stack' || node.type === 'box') {
    for (const child of node.children) assertConfinedChildAllowed(child, container);
  }

  if (node.type === 'row') {
    for (const column of node.columns) {
      for (const child of column.children) assertConfinedChildAllowed(child, container);
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

    for (const child of column.children) assertConfinedChildAllowed(child, 'row column');
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

    // a row never breaks inside itself — taller than one full page means the content can't fit
    // anywhere; fail fast instead of silently drawing past the bottom of the content area
    const fullPageHeight = ctx.contentBottom - ctx.contentTop;
    if (rowHeight > fullPageHeight) {
      throw new KapomLayoutError(
        `row: content height ${rowHeight.toFixed(2)} exceeds one full page (${fullPageHeight.toFixed(2)}) — a row keeps together and cannot split; shorten the content or use plain blocks`,
      );
    }

    ctx.ensureSpace(rowHeight);
    const top = ctx.cursor.y;
    const left = ctx.margins.left; // margins.left (not cursor.x) follows an indent override, same lesson as drawGroupBand

    this.columns.forEach((column, i) => {
      const box = resolved[i];
      if (!box) return;
      const columnCtx = buildConfinedContext(ctx, left + box.x, box.width, top, 'row column');
      for (const block of column.blocks) {
        block.render(columnCtx);
      }
    });

    ctx.advanceY(rowHeight);
  }

  private columnHeight(ctx: MeasureContext, column: RowBlockColumn, width: number): number {
    const columnCtx: MeasureContext = { ...ctx, contentWidth: width };

    return measureBlocksHeight(column.blocks, columnCtx);
  }
}
