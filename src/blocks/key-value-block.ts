import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { applyTextStyle, drawText } from '../core/draw-text';
import { KapomError, KapomLayoutError } from '../core/errors';
import { lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import type { KeyValueNode } from '../types/node';
import type { TextStyle } from '../types/primitives';
import { DEFAULT_TEXT_STYLE } from './text-block';

/** gap between the widest label and the value column when labelWidth is auto (mm) */
const AUTO_LABEL_GAP = 3;

/**
 * label + value pairs as aligned rows — labels bold by default, both styles merged over
 * DEFAULT_TEXT_STYLE (3-layer merge, same color-bleed guard as TextBlock: a style that doesn't
 * set `color` must still fall back to black, not inherit whatever the previous block left).
 * Single-line by design: labels/values are drawn as-is without wrapping (see KeyValueNode JSDoc).
 */
export class KeyValueBlock implements MeasurableBlock {
  private readonly rows: ReadonlyArray<readonly [string, string]>;
  private readonly labelStyle: TextStyle;
  private readonly valueStyle: TextStyle;

  constructor(private readonly node: KeyValueNode) {
    if (node.rows.length === 0) {
      throw new KapomError('keyValue: rows must not be empty');
    }

    if (
      node.labelWidth !== undefined &&
      (!Number.isFinite(node.labelWidth) || node.labelWidth <= 0)
    ) {
      throw new KapomLayoutError(`keyValue: labelWidth must be > 0 (got ${node.labelWidth})`);
    }

    // normalize once at creation, same as TextBlock — measure/render always see the same strings
    this.rows = node.rows.map(([label, value]) => [normalizeText(label), normalizeText(value)]);
    this.labelStyle = { ...DEFAULT_TEXT_STYLE, fontStyle: 'bold', ...node.labelStyle };
    this.valueStyle = { ...DEFAULT_TEXT_STYLE, ...node.valueStyle };
  }

  measureHeight(ctx: MeasureContext): number {
    // measureText with an unbounded width = one line's height at that fontSize (no wrapping here)
    const labelLine = ctx.measureText('X', this.labelStyle.fontSize, Number.MAX_SAFE_INTEGER);
    const valueLine = ctx.measureText('X', this.valueStyle.fontSize, Number.MAX_SAFE_INTEGER);
    return this.rows.length * Math.max(labelLine, valueLine);
  }

  render(ctx: RenderContext): void {
    const { doc, cursor, contentWidth } = ctx;
    const valueAlign = this.node.valueAlign ?? 'left';

    const pitch = Math.max(
      lineHeightOf(doc, this.labelStyle.fontSize),
      lineHeightOf(doc, this.valueStyle.fontSize),
    );
    const labelWidth = this.node.labelWidth ?? this.autoLabelWidth(ctx);

    this.rows.forEach(([label, value], i) => {
      // cursor.y is the box's top edge; jsPDF wants the baseline — shift down one pitch (like TextBlock)
      const baseline = cursor.y + (i + 1) * pitch;

      applyTextStyle(doc, this.labelStyle);
      drawText(doc, label, cursor.x, baseline);

      applyTextStyle(doc, this.valueStyle);
      const free = contentWidth - labelWidth - doc.getTextWidth(value);
      const valueX =
        valueAlign === 'right'
          ? cursor.x + labelWidth + Math.max(0, free)
          : valueAlign === 'center'
            ? cursor.x + labelWidth + Math.max(0, free / 2)
            : cursor.x + labelWidth;
      drawText(doc, value, valueX, baseline);
    });

    ctx.advanceY(this.rows.length * pitch);
  }

  /** widest label at the label style's font + a small gap — measured against the real font metrics */
  private autoLabelWidth(ctx: RenderContext): number {
    applyTextStyle(ctx.doc, this.labelStyle);
    const widest = Math.max(...this.rows.map(([label]) => ctx.doc.getTextWidth(label)));
    return widest + AUTO_LABEL_GAP;
  }
}
