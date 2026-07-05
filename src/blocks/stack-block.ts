import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { deriveMeasureContext } from '../core/measure-context';

/**
 * composite: render ลูกตามลำดับ — measureHeight รวมแบบ recursive (เผื่อ stack ซ้อน stack/section)
 * render ทำ per-child ensureSpace เอง (เหมือน engine.render loop ระดับบนสุด) เพราะ
 * text/spacer/divider/image ไม่ ensureSpace ตัวเอง — ถ้าไม่ทำที่นี่ ลูกที่ตกขอบหน้ากลาง
 * stack จะไม่ break และวาดทับ footer/ล้นหน้าไป
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
