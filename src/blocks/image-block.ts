import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomLayoutError } from '../core/errors';
import type { ImageNode } from '../types/node';

/** width exceeding contentWidth → scales down proportionally (keeps aspect ratio) instead of forcing the user to compute it themselves */
function resolveImageSize(
  node: ImageNode,
  contentWidth: number,
): { width: number; height: number } {
  if (node.width <= contentWidth) {
    return { width: node.width, height: node.height };
  }
  const scale = contentWidth / node.width;
  return { width: contentWidth, height: node.height * scale };
}

export class ImageBlock implements MeasurableBlock {
  constructor(private readonly node: ImageNode) {
    if (!Number.isFinite(node.width) || node.width <= 0) {
      throw new KapomLayoutError(`ImageNode.width must be > 0 (got ${node.width})`);
    }
    if (!Number.isFinite(node.height) || node.height <= 0) {
      throw new KapomLayoutError(`ImageNode.height must be > 0 (got ${node.height})`);
    }
  }

  measureHeight(ctx: MeasureContext): number {
    return resolveImageSize(this.node, ctx.contentWidth).height;
  }

  render(ctx: RenderContext): void {
    const { doc, cursor, contentWidth } = ctx;
    const { width, height } = resolveImageSize(this.node, contentWidth);

    doc.addImage(this.node.data, this.node.format, cursor.x, cursor.y, width, height);

    ctx.advanceY(height);
  }
}
