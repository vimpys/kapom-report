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
 * ตำแหน่งหนึ่งจุดใน band — grid 3×2 (top/bottom มาจากว่าใช้เป็น pageHeader หรือ pageFooter,
 * left/center/right คือ align ตรงนี้); format เป็น template string ใช้ {token} (ดู system-field.ts)
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
  /** inject เวลาได้เอง (เช่น test) — default new Date() ตอน render จริงแต่ละหน้า */
  now?: () => Date;
}

function resolveAnchorStyle(override?: Partial<TextStyle>): TextStyle {
  return { ...DEFAULT_ANCHOR_STYLE, ...override };
}

function anchorX(align: HAlign, ctx: PageBandContext, textWidth: number): number {
  if (align === 'left') return ctx.x;
  if (align === 'right') return ctx.x + ctx.width - textWidth;
  return ctx.x + (ctx.width - textWidth) / 2;
}

/**
 * แปลง Anchor[] เป็น PageBand — ไม่ต้องแก้ core/engine.ts เลย เพราะประกอบเป็น PageBand ธรรมดา
 * (assign ให้ RenderEngineOptions.pageHeader = top, pageFooter = bottom); ชน align เดียวกัน
 * ใน band เดียวกัน → throw ตอนสร้าง (fail-fast แบบเดียวกับ registerBlockType/ReportRegistry)
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
      const x = anchorX(anchor.align, ctx, textWidth);
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
