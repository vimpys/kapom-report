import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { splitTextLines, lineHeightOf } from '../core/text-metrics';
import type { TextStyle } from '../types/primitives';
import type { TextNode } from '../types/node';

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 10,
  fontStyle: 'normal',
  color: [0, 0, 0],
};

function resolveTextStyle(override?: Partial<TextStyle>): TextStyle {
  return { ...DEFAULT_TEXT_STYLE, ...override };
}

export class TextBlock implements MeasurableBlock {
  constructor(private readonly node: TextNode) {}

  measureHeight(ctx: MeasureContext): number {
    const style = resolveTextStyle(this.node.style);
    return ctx.measureText(this.node.content, style.fontSize, ctx.contentWidth);
  }

  render(ctx: RenderContext): void {
    const style = resolveTextStyle(this.node.style);
    const { doc, cursor, contentWidth } = ctx;

    doc.setFontSize(style.fontSize);
    const currentFont = doc.getFont();
    doc.setFont(style.fontFamily ?? currentFont.fontName, style.fontStyle ?? 'normal');
    if (style.color) {
      const [r, g, b] = style.color;
      doc.setTextColor(r, g, b);
    }

    const lines = splitTextLines(doc, this.node.content, style.fontSize, contentWidth);
    const singleLineHeight = lineHeightOf(doc, style.fontSize);
    // jsPDF ใช้ y เป็น baseline ของบรรทัดแรก ไม่ใช่ขอบบน — เลื่อนลง 1 line-height
    // ให้ตรงกับความหมายของ cursor.y ที่ engine ทั้งระบบยึดเป็นขอบบนกล่อง
    doc.text(lines, cursor.x, cursor.y + singleLineHeight);

    ctx.advanceY(lines.length * singleLineHeight);
  }
}
