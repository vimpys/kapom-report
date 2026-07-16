import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { deriveMeasureContext, measureBlocksHeight } from '../core/measure-context';

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
    return measureBlocksHeight(this.children, ctx);
  }

  render(ctx: RenderContext): void {
    const measureCtx = deriveMeasureContext(ctx);
    for (const child of this.children) {
      // same contract as the engine loop: a self-splitting child only needs room to start
      const height = child.minStartHeight?.(measureCtx) ?? child.measureHeight(measureCtx);
      ctx.ensureSpace(height);
      child.render(ctx);
    }
  }
}
