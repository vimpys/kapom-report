import type { jsPDF } from 'jspdf';
import type { FontConfig } from '../font/font-config';
import { registerFonts } from '../font/register-fonts';
import { nativeNumeric } from '../numeric/numeric-strategy';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { DeepPartial } from '../types/primitives';
import type { Typography } from '../types/typography';
import { resolveTypography } from '../types/typography';
import type {
  MeasurableBlock,
  MeasureContext,
  PageMargins,
  RenderContext,
} from './context';
import { PdfCursor } from './cursor';
import { drawText } from './draw-text';
import type { PageBand } from './page-band';
import { measureTextBlockHeight } from './text-metrics';
import type { Watermark, WatermarkInput } from './watermark';
import { resolveWatermark } from './watermark';

export interface RenderEngineOptions {
  margins?: Partial<PageMargins>;
  numeric?: NumericStrategy;
  /** ลงทะเบียนก่อน block แรก render เสมอ (VFS timing) — ตั้งเป็น default font ของทั้ง doc ด้วย */
  font?: FontConfig;
  /** font token ต่อ row-type (columnHeader/detailRow/groupHeader/...) — merge ทับ DEFAULT_TYPOGRAPHY ทีละ token */
  typography?: DeepPartial<Typography>;
  /** page header ซ้ำทุกหน้า — กินพื้นที่สงวนบนสุด (หัก content area); วาดตอน finalize() */
  pageHeader?: PageBand;
  /** page footer ซ้ำทุกหน้า — กินพื้นที่สงวนล่างสุด; วาดตอน finalize() */
  pageFooter?: PageBand;
  /**
   * watermark ซ้ำทุกหน้า — ไม่หัก content area (ต่าง page header/footer); วาดตอน finalize() ก่อน band
   * รับ preset `{ text: 'DRAFT', ... }` หรือ render callback เต็มรูป (escape hatch)
   */
  watermark?: WatermarkInput;
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
  private readonly typography: Typography;
  private readonly pageHeader: PageBand | undefined;
  private readonly pageFooter: PageBand | undefined;
  private readonly watermark: Watermark | undefined;

  constructor(doc: jsPDF, options: RenderEngineOptions = {}) {
    this.doc = doc;
    this.margins = { ...DEFAULT_PAGE_MARGINS, ...options.margins };
    this.numeric = options.numeric ?? nativeNumeric;
    this.typography = resolveTypography(options.typography);
    this.pageHeader = options.pageHeader;
    this.pageFooter = options.pageFooter;
    this.watermark = options.watermark !== undefined ? resolveWatermark(options.watermark) : undefined;

    if (options.font) {
      // ต้องเกิดก่อน block แรก render เสมอ — constructor รันก่อน .render() ทุกครั้งอยู่แล้ว
      const defaultFamily = registerFonts(doc, options.font);
      doc.setFont(defaultFamily, 'normal');
    }

    this.cursor = new PdfCursor({
      pageWidth: doc.internal.pageSize.getWidth(),
      pageHeight: doc.internal.pageSize.getHeight(),
      margins: this.margins,
      headerHeight: this.pageHeader?.height ?? 0,
      footerHeight: this.pageFooter?.height ?? 0,
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
      typography: this.typography,
      measureText: (text, fontSize, maxWidth) =>
        measureTextBlockHeight(this.doc, text, fontSize, maxWidth),
    };
  }

  createRenderContext(): RenderContext {
    return {
      doc: this.doc,
      // PdfCursor เป็น live view — block อ่าน x/y/pageIndex ล่าสุดผ่าน getter เสมอ
      cursor: this.cursor,
      margins: this.margins,
      contentWidth: this.cursor.contentWidth,
      contentTop: this.cursor.contentTop,
      contentBottom: this.cursor.contentBottom,
      numeric: this.numeric,
      typography: this.typography,
      advanceY: (amount) => {
        this.cursor.advanceY(amount);
      },
      ensureSpace: (requiredHeight) => {
        this.cursor.ensureSpace(requiredHeight);
      },
      syncCursor: (pageIndex, y) => {
        this.cursor.syncTo(pageIndex, y);
      },
      forcePageBreak: () => {
        if (!this.cursor.isAtTopOfPage) {
          this.cursor.breakPage();
        }
      },
    };
  }

  /**
   * วาด page header/footer band ทุกหน้า — ต้องเรียกครั้งเดียวหลัง render() ทุก block จบ
   * (band วาดตอนนี้ไม่ใช่ตอน page-break เพราะ AutoTable สร้างหน้าเองข้าม onPageBreak ของเรา —
   * iterate ทุกหน้าใน doc จริงตอนจบจึงครอบทุกหน้าไม่ว่าใครสร้าง + รู้ pageCount แล้ว)
   * no-op ถ้าไม่มี band; ปลอดภัยแม้ไม่มี — facade/ผู้ใช้เรียกได้เสมอ
   */
  finalize(): void {
    if (!this.pageHeader && !this.pageFooter && !this.watermark) return;

    const pageCount = this.doc.getNumberOfPages();
    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();
    const bandWidth = pageWidth - this.margins.left - this.margins.right;
    const currentPage = this.doc.getCurrentPageInfo().pageNumber;

    for (let page = 1; page <= pageCount; page += 1) {
      const pageIndex = page - 1;
      this.doc.setPage(page);

      // watermark ก่อน header/footer เสมอ — ให้ header/footer (ทึบ) ยังคมชัดอยู่บนสุด
      if (this.watermark && (page > 1 || this.watermark.showOnFirstPage !== false)) {
        this.watermark.render({
          doc: this.doc,
          pageIndex,
          pageCount,
          pageWidth,
          pageHeight,
          drawText: (text, x, y) => drawText(this.doc, text, x, y),
        });
      }
      if (this.pageHeader && (page > 1 || this.pageHeader.showOnFirstPage !== false)) {
        this.drawBand(this.pageHeader, this.margins.top, bandWidth, pageIndex, pageCount);
      }
      if (this.pageFooter && (page > 1 || this.pageFooter.showOnFirstPage !== false)) {
        const footerTop = pageHeight - this.margins.bottom - this.pageFooter.height;
        this.drawBand(this.pageFooter, footerTop, bandWidth, pageIndex, pageCount);
      }
    }

    this.doc.setPage(currentPage); // คืน active page เดิม กัน caller งงถ้าวาดต่อ
  }

  private drawBand(
    band: PageBand,
    top: number,
    width: number,
    pageIndex: number,
    pageCount: number,
  ): void {
    band.render({
      doc: this.doc,
      pageIndex,
      pageCount,
      x: this.margins.left,
      y: top,
      width,
      height: band.height,
      drawText: (text, x, y) => drawText(this.doc, text, x, y),
    });
  }
}
