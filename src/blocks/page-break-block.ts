import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';

/**
 * Forces the flow onto a new page (a standalone counterpart to SectionNode.breakBefore) — takes no
 * vertical space; render calls ctx.forcePageBreak(), which is a no-op when the cursor is already at
 * the top of a page (so it never leaves a blank page). Not allowed inside a confined zone
 * (row/box/band), where forcePageBreak has no meaning — rejected at build time by
 * assertConfinedChildAllowed.
 */
export class PageBreakBlock implements MeasurableBlock {
  measureHeight(_ctx: MeasureContext): number {
    return 0;
  }

  render(ctx: RenderContext): void {
    ctx.forcePageBreak();
  }
}
