import type { MeasurableBlock, MeasureContext, RenderContext } from './context';
import { measureTextBlockHeight } from './text-metrics';

/**
 * Total natural height of a list of blocks — the "composite measure" every composite shares
 * (stack/section/box/row column/bottomAnchor, plus the engine measuring a band's blocks).
 * Sums each block's own measureHeight against the same context.
 */
export function measureBlocksHeight(
  blocks: readonly MeasurableBlock[],
  ctx: MeasureContext,
): number {
  return blocks.reduce((total, block) => total + block.measureHeight(ctx), 0);
}

/**
 * Builds a MeasureContext from an existing RenderContext — used by composite blocks
 * (stack/section) that need to measure each child "in the middle of" rendering, to do
 * per-child ensureSpace the same way the engine's render loop does for top-level blocks
 * (keeps a child that overflows the remaining space from spilling off the page without breaking)
 */
export function deriveMeasureContext(ctx: RenderContext): MeasureContext {
  return {
    pageWidth: ctx.doc.internal.pageSize.getWidth(),
    contentWidth: ctx.contentWidth,
    numeric: ctx.numeric,
    typography: ctx.typography,
    measureText: (text, fontSize, maxWidth) =>
      measureTextBlockHeight(ctx.doc, text, fontSize, maxWidth),
  };
}
