import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { deriveMeasureContext } from '../core/measure-context';

/**
 * composite: renders children in order — measureHeight sums recursively (in case a stack nests
 * another stack/section); render does per-child ensureSpace itself (like the top-level
 * engine.render loop), because text/spacer/divider/image don't call ensureSpace themselves —
 * without this, a child that overflows the page in the middle of a stack wouldn't break and
 * would draw over the footer or spill off the page
 */
export class StackBlock implements MeasurableBlock {
  constructor(private readonly children: readonly MeasurableBlock[]) {}

  measureHeight(ctx: MeasureContext): number {
    return this.children.reduce((sum, child) => sum + child.measureHeight(ctx), 0);
  }

  render(ctx: RenderContext): void {
    const measureCtx = deriveMeasureContext(ctx);
    for (const child of this.children) {
      const height = child.measureHeight(measureCtx);
      ctx.ensureSpace(height);
      child.render(ctx);
    }
  }
}
