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
 * `role` selects a Typography token as the base instead of DEFAULT_TEXT_STYLE; node.style always
 * overrides one property at a time. DEFAULT_TEXT_STYLE is always the innermost fallback layer
 * (not just when role is undefined) — some tokens (e.g. sectionHeading/detailRow/groupHeader/
 * groupFooter/reportTitle) don't define `color`; without this fallback, TextBlock would skip
 * doc.setTextColor() and be left with whatever color the previous block left behind (observed
 * for real in a demo: sectionHeading rendered gray because it inherited the color from the
 * preceding reportSubtitle)
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
  /** normalize once at creation — measure/render always use the same value, avoiding width drift across the two steps */
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
    // jsPDF treats y as the first line's baseline, not the top edge — shift down by 1
    // line-height to match cursor.y's meaning, which the whole engine treats as a box's top edge
    drawText(doc, lines, cursor.x, cursor.y + singleLineHeight);

    ctx.advanceY(lines.length * singleLineHeight);
  }
}
