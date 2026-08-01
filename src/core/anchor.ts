import type { HAlign, TextStyle } from '../types/primitives';
import type { DateFormat } from '../format/date-format';
import type { PageBand, PageBandContext, PageBandRenderer } from './page-band';
import { applyTextStyle } from './draw-text';
import { resolveSystemFields } from './system-field';
import { lineHeightOf } from './text-metrics';
import { KapomError } from './errors';

export const DEFAULT_ANCHOR_FONT_SIZE = 9;

const DEFAULT_ANCHOR_STYLE: TextStyle = {
  fontSize: DEFAULT_ANCHOR_FONT_SIZE,
  fontStyle: 'normal',
  color: [0, 0, 0],
};

/**
 * One position within a band — a 3×2 grid (top/bottom comes from whether it's used as a
 * pageHeader or pageFooter; left/center/right is this `align`); format is a template string
 * using {token} (see system-field.ts)
 */
export interface Anchor {
  align: HAlign;
  format: string;
  style?: Partial<TextStyle>;
}

export interface AnchoredBandOptions {
  height: number;
  anchors: readonly Anchor[];
  showOnFirstPage?: boolean;
  dateFormat?: DateFormat;
  /** inject the time yourself (e.g. for testing) — defaults to new Date() at each page's real render */
  now?: () => Date;
}

function resolveAnchorStyle(override?: Partial<TextStyle>): TextStyle {
  return { ...DEFAULT_ANCHOR_STYLE, ...override };
}

/** horizontal position for a piece of text within a [x, x+width) span — shared with core/page-number.ts */
export function anchorX(align: HAlign, x: number, width: number, textWidth: number): number {
  if (align === 'left') return x;
  if (align === 'right') return x + width - textWidth;

  return x + (width - textWidth) / 2;
}

/**
 * Converts an Anchor[] into a PageBand — no need to touch core/engine.ts at all, since it just
 * composes a plain PageBand (assign it to RenderEngineOptions.pageHeader = top, pageFooter =
 * bottom); the same align used twice in one band → throws at creation time (fail-fast, same as registerBlockType/ReportRegistry)
 */
export function createAnchoredBand(options: AnchoredBandOptions): PageBand {
  const seenAlign = new Set<HAlign>();
  for (const anchor of options.anchors) {
    if (seenAlign.has(anchor.align)) {
      throw new KapomError(`Anchor: position '${anchor.align}' is used more than once in a single band`);
    }

    seenAlign.add(anchor.align);
  }

  const render: PageBandRenderer = (ctx: PageBandContext) => {
    const now = options.now ? options.now() : new Date();

    for (const anchor of options.anchors) {
      const style = resolveAnchorStyle(anchor.style);
      const text = resolveSystemFields(
        anchor.format,
        { pageNumber: ctx.pageIndex + 1, totalPages: ctx.pageCount, now },
        options.dateFormat,
      );

      const previousSize = ctx.doc.getFontSize();
      const previousFont = ctx.doc.getFont();
      applyTextStyle(ctx.doc, style);

      const textWidth = ctx.doc.getTextWidth(text);
      const x = anchorX(anchor.align, ctx.x, ctx.width, textWidth);
      const y = ctx.y + ctx.height / 2 + lineHeightOf(ctx.doc, style.fontSize) / 2;
      ctx.drawText(text, x, y);

      ctx.doc.setFontSize(previousSize);
      ctx.doc.setFont(previousFont.fontName, previousFont.fontStyle);
    }
  };

  return options.showOnFirstPage === undefined
    ? { height: options.height, render }
    : { height: options.height, render, showOnFirstPage: options.showOnFirstPage };
}
