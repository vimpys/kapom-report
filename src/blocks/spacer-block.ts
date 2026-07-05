import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomLayoutError } from '../core/errors';
import type { SpacerNode } from '../types/node';

export class SpacerBlock implements MeasurableBlock {
  constructor(private readonly node: SpacerNode) {
    if (!Number.isFinite(node.height) || node.height < 0) {
      throw new KapomLayoutError(`SpacerNode.height ต้องเป็นค่า >= 0 (ได้ ${node.height})`);
    }
  }

  measureHeight(_ctx: MeasureContext): number {
    return this.node.height;
  }

  render(ctx: RenderContext): void {
    ctx.advanceY(this.node.height);
  }
}
