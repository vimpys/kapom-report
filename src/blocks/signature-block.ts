import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { applyTextStyle, drawText } from '../core/draw-text';
import { splitTextLines, lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import { KapomLayoutError } from '../core/errors';
import type { TextStyle } from '../types/primitives';
import type { SignatureNode } from '../types/node';
import { DEFAULT_TEXT_STYLE } from './text-block';
import { DEFAULT_DIVIDER_COLOR, DEFAULT_DIVIDER_THICKNESS } from './divider-block';

export const DEFAULT_SIGNATURE_SIGN_HEIGHT = 15;
export const DEFAULT_SIGNATURE_LABEL_GAP = 2;
export const DEFAULT_SIGNATURE_SLOT_GAP = 10;

interface NormalizedSlot {
  readonly label: string;
}

/**
 * เส้นเซ็นชื่อ + label ใต้เส้น — แบ่ง contentWidth เท่ากันตามจำนวน slot (Report Footer, roadmap 6d)
 * ไม่ใช้ Typography token (ล็อกไว้แค่ 9 ตัวสำหรับ table/text แล้ว) — style ใช้ default ของตัวเองเหมือน DividerNode
 */
export class SignatureBlock implements MeasurableBlock {
  private readonly slots: readonly NormalizedSlot[];
  private readonly signHeight: number;
  private readonly labelGap: number;
  private readonly slotGap: number;
  private readonly style: TextStyle;

  constructor(node: SignatureNode) {
    if (node.slots.length === 0) {
      throw new KapomLayoutError('SignatureNode.slots must contain at least 1 slot');
    }
    this.signHeight = node.signHeight ?? DEFAULT_SIGNATURE_SIGN_HEIGHT;
    if (!Number.isFinite(this.signHeight) || this.signHeight < 0) {
      throw new KapomLayoutError(
        `SignatureNode.signHeight must be >= 0 (got ${this.signHeight})`,
      );
    }
    this.labelGap = node.labelGap ?? DEFAULT_SIGNATURE_LABEL_GAP;
    this.slotGap = node.slotGap ?? DEFAULT_SIGNATURE_SLOT_GAP;
    this.style = { ...DEFAULT_TEXT_STYLE, ...node.style };
    // normalize ครั้งเดียวตอนสร้าง เหมือน TextBlock — measure/render ใช้ค่าเดียวกันเสมอ
    this.slots = node.slots.map((slot) => ({ label: normalizeText(slot.label) }));
  }

  private columnWidth(contentWidth: number): number {
    const n = this.slots.length;
    return (contentWidth - (n - 1) * this.slotGap) / n;
  }

  measureHeight(ctx: MeasureContext): number {
    const columnWidth = this.columnWidth(ctx.contentWidth);
    const labelHeights = this.slots.map((slot) =>
      ctx.measureText(slot.label, this.style.fontSize, columnWidth),
    );
    return this.signHeight + this.labelGap + Math.max(...labelHeights);
  }

  render(ctx: RenderContext): void {
    const { doc, cursor, contentWidth } = ctx;
    const columnWidth = this.columnWidth(contentWidth);

    applyTextStyle(doc, this.style);
    const [lineR, lineG, lineB] = DEFAULT_DIVIDER_COLOR;
    doc.setDrawColor(lineR, lineG, lineB);
    doc.setLineWidth(DEFAULT_DIVIDER_THICKNESS);

    const lineY = cursor.y + this.signHeight;
    const singleLineHeight = lineHeightOf(doc, this.style.fontSize);
    let maxLabelLines = 1;

    this.slots.forEach((slot, index) => {
      const columnX = cursor.x + index * (columnWidth + this.slotGap);
      doc.line(columnX, lineY, columnX + columnWidth, lineY);

      const lines = splitTextLines(doc, slot.label, this.style.fontSize, columnWidth);
      maxLabelLines = Math.max(maxLabelLines, lines.length);
      lines.forEach((line, lineIndex) => {
        const textWidth = doc.getTextWidth(line);
        const textX = columnX + (columnWidth - textWidth) / 2;
        const textY = lineY + this.labelGap + (lineIndex + 1) * singleLineHeight;
        drawText(doc, line, textX, textY);
      });
    });

    ctx.advanceY(this.signHeight + this.labelGap + maxLabelLines * singleLineHeight);
  }
}
