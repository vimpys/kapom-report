import type { MeasureContext, RenderContext } from './context';
import { measureTextBlockHeight } from './text-metrics';

/**
 * สร้าง MeasureContext จาก RenderContext ที่มีอยู่แล้ว — ใช้โดย composite block
 * (stack/section) ที่ต้อง measure ลูกทีละตัว "ระหว่าง" render เพื่อทำ per-child
 * ensureSpace เหมือน engine.render loop ทำกับ block ระดับบนสุด (กันลูกที่เกิน
 * พื้นที่เหลือตกขอบหน้าโดยไม่ break)
 */
export function deriveMeasureContext(ctx: RenderContext): MeasureContext {
  return {
    pageWidth: ctx.doc.internal.pageSize.getWidth(),
    contentWidth: ctx.contentWidth,
    numeric: ctx.numeric,
    typography: ctx.typography,
    measureText: (text, fontSize, maxWidth) =>
      measureTextBlockHeight(ctx.doc, text, fontSize, maxWidth),
  };
}
