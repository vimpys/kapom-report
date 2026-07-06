import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { applyTextStyle, drawText } from '../core/draw-text';
import { splitTextLines, lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import type { TextStyle } from '../types/primitives';
import type { TextNode } from '../types/node';
import type { Typography } from '../types/typography';

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 10,
  fontStyle: 'normal',
  color: [0, 0, 0],
};

/**
 * role เลือก Typography token เป็น base แทน DEFAULT_TEXT_STYLE; node.style ทับทีละ property เสมอ
 * DEFAULT_TEXT_STYLE เป็น fallback ชั้นในสุดเสมอ (ไม่ใช่แค่ตอน role undefined) — บาง token
 * (เช่น sectionHeading/detailRow/groupHeader/groupFooter/reportTitle) ไม่ได้กำหนด `color` ไว้
 * ถ้าไม่ fallback แบบนี้ TextBlock จะข้าม doc.setTextColor() แล้วเหลือสีจาก block ก่อนหน้าติดค้างอยู่
 * (สังเกตได้จริงตอน demo: sectionHeading เรนเดอร์เป็นสีเทาเพราะสืบสีจาก reportSubtitle ก่อนหน้า)
 */
function resolveTextStyle(
  typography: Typography,
  role: keyof Typography | undefined,
  override?: Partial<TextStyle>,
): TextStyle {
  const base = role ? typography[role] : DEFAULT_TEXT_STYLE;
  return { ...DEFAULT_TEXT_STYLE, ...base, ...override };
}

export class TextBlock implements MeasurableBlock {
  /** normalize ครั้งเดียวตอนสร้าง — measure/render ใช้ค่าเดียวกันเสมอ กัน width เพี้ยนข้ามสองขั้น */
  private readonly content: string;

  constructor(private readonly node: TextNode) {
    this.content = normalizeText(node.content);
  }

  measureHeight(ctx: MeasureContext): number {
    const style = resolveTextStyle(ctx.typography, this.node.role, this.node.style);
    return ctx.measureText(this.content, style.fontSize, ctx.contentWidth);
  }

  render(ctx: RenderContext): void {
    const style = resolveTextStyle(ctx.typography, this.node.role, this.node.style);
    const { doc, cursor, contentWidth } = ctx;

    applyTextStyle(doc, style);

    const lines = splitTextLines(doc, this.content, style.fontSize, contentWidth);
    const singleLineHeight = lineHeightOf(doc, style.fontSize);
    // jsPDF ใช้ y เป็น baseline ของบรรทัดแรก ไม่ใช่ขอบบน — เลื่อนลง 1 line-height
    // ให้ตรงกับความหมายของ cursor.y ที่ engine ทั้งระบบยึดเป็นขอบบนกล่อง
    drawText(doc, lines, cursor.x, cursor.y + singleLineHeight);

    ctx.advanceY(lines.length * singleLineHeight);
  }
}
