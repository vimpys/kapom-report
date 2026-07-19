import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { deriveMeasureContext, measureBlocksHeight } from '../core/measure-context';

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
    return measureBlocksHeight(this.children, ctx);
  }

  render(ctx: RenderContext): void {
    const measureCtx = deriveMeasureContext(ctx);
    const childrenHeight = measureBlocksHeight(this.children, measureCtx);

    // Break once, as a group, if the children don't fit in the space left on this page — so they get
    // pinned to the bottom of a fresh page rather than stranded mid-page. (Redundant with the engine's
    // break-before check in the normal flow, but keeps the block correct when rendered directly.)
    ctx.ensureSpace(childrenHeight);

    const gap = ctx.contentBottom - ctx.cursor.y - childrenHeight;
    if (gap > 0) ctx.advanceY(gap);

    // Render the children directly — NO per-child ensureSpace. The group already fits (checked above)
    // and advanceY pinned it to the bottom. A per-child ensureSpace would re-measure the space we
    // deliberately filled and, on a floating-point rounding at the exact bottom edge, spuriously break
    // the last child to the next page — leaving the summary stranded at the top of a new page (B2).
    for (const child of this.children) child.render(ctx);
  }
}
