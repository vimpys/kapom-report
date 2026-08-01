import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomLayoutError } from '../core/errors';
import type { RawNode } from '../types/node';

/**
 * escape hatch — wraps the user's measure+draw contract into the engine loop:
 * the engine still runs measureHeight → ensureSpace (auto page-break) → render, so the user only
 * writes raw jsPDF drawing at the position the engine hands them; they don't manage page-breaks.
 * measure is called in both steps (like ImageBlock) — it must be deterministic for the same contentWidth.
 */
export class RawBlock implements MeasurableBlock {
  constructor(private readonly node: RawNode) {}

  private resolveHeight(contentWidth: number): number {
    const height = this.node.measure(contentWidth);
    if (!Number.isFinite(height) || height < 0) {
      throw new KapomLayoutError(`RawNode.measure must return a value >= 0 (got ${height})`);
    }

    return height;
  }

  measureHeight(ctx: MeasureContext): number {
    return this.resolveHeight(ctx.contentWidth);
  }

  render(ctx: RenderContext): void {
    const { doc, cursor, contentWidth } = ctx;
    const height = this.resolveHeight(contentWidth);
    this.node.draw(doc, { x: cursor.x, y: cursor.y, contentWidth });
    ctx.advanceY(height);
  }
}
