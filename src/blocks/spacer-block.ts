import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomLayoutError } from '../core/errors';
import type { SpacerNode } from '../types/node';

/** the gap `spacer()` / `{ type: 'spacer' }` produces zero-config — a standard medium section gap */
export const DEFAULT_SPACER_HEIGHT = 4;

export class SpacerBlock implements MeasurableBlock {
  private readonly height: number;

  constructor(node: SpacerNode) {
    this.height = node.height ?? DEFAULT_SPACER_HEIGHT;
    if (!Number.isFinite(this.height) || this.height < 0) {
      throw new KapomLayoutError(`SpacerNode.height must be >= 0 (got ${this.height})`);
    }
  }

  measureHeight(_ctx: MeasureContext): number {
    return this.height;
  }

  render(ctx: RenderContext): void {
    ctx.advanceY(this.height);
  }
}
