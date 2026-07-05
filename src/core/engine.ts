import type { jsPDF } from 'jspdf';
import { nativeNumeric } from '../numeric/numeric-strategy';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type {
  MeasurableBlock,
  MeasureContext,
  PageMargins,
  RenderContext,
} from './context';
import { PdfCursor } from './cursor';

export interface RenderEngineOptions {
  margins?: Partial<PageMargins>;
  numeric?: NumericStrategy;
}

/** หน่วยตาม doc — 15 เหมาะกับ doc หน่วย mm (default ของ jsPDF); doc หน่วย pt ควร override */
export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 15,
  bottom: 15,
  left: 15,
  right: 15,
};

/**
 * ครอบ jsPDF doc หนึ่งตัว — คุม cursor/page-break กลาง, inject context ให้ทุก block
 * block ห้ามเรียก doc.addPage() เอง; ขอพื้นที่ผ่าน ctx.ensureSpace เท่านั้น
 */
export class RenderEngine {
  private readonly doc: jsPDF;
  private readonly cursor: PdfCursor;
  private readonly margins: PageMargins;
  private readonly numeric: NumericStrategy;

  constructor(doc: jsPDF, options: RenderEngineOptions = {}) {
    this.doc = doc;
    this.margins = { ...DEFAULT_PAGE_MARGINS, ...options.margins };
    this.numeric = options.numeric ?? nativeNumeric;
    this.cursor = new PdfCursor({
      pageWidth: doc.internal.pageSize.getWidth(),
      pageHeight: doc.internal.pageSize.getHeight(),
      margins: this.margins,
      onPageBreak: () => {
        this.doc.addPage();
      },
    });
  }

  /**
   * render ตามลำดับ: measure → ensureSpace (auto page-break) → render
   * keep-together ระดับ composite เป็นหน้าที่ของ block (measureHeight recursive)
   */
  render(blocks: readonly MeasurableBlock[]): void {
    const measureCtx = this.createMeasureContext();
    const renderCtx = this.createRenderContext();
    for (const block of blocks) {
      const height = block.measureHeight(measureCtx);
      this.cursor.ensureSpace(height);
      block.render(renderCtx);
    }
  }

  createMeasureContext(): MeasureContext {
    return {
      pageWidth: this.doc.internal.pageSize.getWidth(),
      contentWidth: this.cursor.contentWidth,
      numeric: this.numeric,
      measureText: (text, fontSize, maxWidth) =>
        this.measureTextHeight(text, fontSize, maxWidth),
    };
  }

  createRenderContext(): RenderContext {
    return {
      doc: this.doc,
      // PdfCursor เป็น live view — block อ่าน x/y/pageIndex ล่าสุดผ่าน getter เสมอ
      cursor: this.cursor,
      margins: this.margins,
      contentWidth: this.cursor.contentWidth,
      numeric: this.numeric,
      advanceY: (amount) => {
        this.cursor.advanceY(amount);
      },
      ensureSpace: (requiredHeight) => {
        this.cursor.ensureSpace(requiredHeight);
      },
    };
  }

  private measureTextHeight(
    text: string,
    fontSize: number,
    maxWidth: number,
  ): number {
    const previousSize = this.doc.getFontSize();
    this.doc.setFontSize(fontSize);
    // jspdf ประกาศ return เป็น any → รับเป็น unknown แล้ว narrow
    const split: unknown = this.doc.splitTextToSize(text, maxWidth);
    this.doc.setFontSize(previousSize);
    const lineCount = Array.isArray(split) ? split.length : 1;
    // fontSize เป็น pt เสมอ → หาร scaleFactor แปลงกลับเป็นหน่วยของ doc
    const lineHeight =
      (fontSize * this.doc.getLineHeightFactor()) / this.doc.internal.scaleFactor;
    return lineCount * lineHeight;
  }
}
