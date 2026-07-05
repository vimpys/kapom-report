import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomLayoutError } from '../core/errors';
import type { RGB } from '../types/primitives';
import type { DividerNode } from '../types/node';

export const DEFAULT_DIVIDER_THICKNESS = 0.5;
export const DEFAULT_DIVIDER_COLOR: RGB = [0, 0, 0];

export class DividerBlock implements MeasurableBlock {
  private readonly thickness: number;

  constructor(private readonly node: DividerNode) {
    this.thickness = node.thickness ?? DEFAULT_DIVIDER_THICKNESS;
    if (!Number.isFinite(this.thickness) || this.thickness <= 0) {
      throw new KapomLayoutError(
        `DividerNode.thickness ต้องเป็นค่า > 0 (ได้ ${this.thickness})`,
      );
    }
  }

  measureHeight(_ctx: MeasureContext): number {
    return this.thickness;
  }

  render(ctx: RenderContext): void {
    const { doc, cursor, contentWidth } = ctx;
    const [r, g, b] = this.node.color ?? DEFAULT_DIVIDER_COLOR;

    doc.setDrawColor(r, g, b);
    doc.setLineWidth(this.thickness);
    const lineY = cursor.y + this.thickness / 2;
    doc.line(cursor.x, lineY, cursor.x + contentWidth, lineY);

    ctx.advanceY(this.thickness);
  }
}
