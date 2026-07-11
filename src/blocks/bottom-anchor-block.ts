import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { deriveMeasureContext } from '../core/measure-context';

/**
 * Pins its children to the bottom of the current page. At render it measures the children, fills
 * the remaining gap (contentBottom − cursor.y − children height) by advancing the cursor, then
 * renders the children in order — so a signature / report footer sits at the page bottom instead
 * of flowing right after the body. If the body already reaches the bottom (gap ≤ 0) it just
 * renders the children where the cursor is (no negative advance).
 *
 * measureHeight reports only the children's own height (not the gap) so the engine's break-before
 * check keeps it on the current page when the children fit — the gap is space that was already
 * there, not extra height the block needs reserved.
 */
export class BottomAnchorBlock implements MeasurableBlock {
  constructor(private readonly children: readonly MeasurableBlock[]) {}

  measureHeight(ctx: MeasureContext): number {
    return this.children.reduce((sum, child) => sum + child.measureHeight(ctx), 0);
  }

  render(ctx: RenderContext): void {
    const measureCtx = deriveMeasureContext(ctx);
    const childrenHeight = this.children.reduce((sum, child) => sum + child.measureHeight(measureCtx), 0);

    const gap = ctx.contentBottom - ctx.cursor.y - childrenHeight;
    if (gap > 0) ctx.advanceY(gap);

    // render children like a stack (per-child ensureSpace) so a child that still overflows breaks
    for (const child of this.children) {
      const height = child.measureHeight(measureCtx);
      ctx.ensureSpace(height);
      child.render(ctx);
    }
  }
}
