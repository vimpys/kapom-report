import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { StackBlock } from './stack-block';

/**
 * Identical to StackBlock in every way (renders children in order) but keeps a `name` around
 * for reference — not used during rendering itself (awaits the Report Registry selecting a
 * section by name)
 */
export class SectionBlock implements MeasurableBlock {
  private readonly stack: StackBlock;

  constructor(
    readonly name: string,
    children: readonly MeasurableBlock[],
    private readonly breakBefore: boolean = false,
  ) {
    this.stack = new StackBlock(children);
  }

  measureHeight(ctx: MeasureContext): number {
    return this.stack.measureHeight(ctx);
  }

  render(ctx: RenderContext): void {
    if (this.breakBefore) {
      ctx.forcePageBreak();
    }

    this.stack.render(ctx);
  }
}
