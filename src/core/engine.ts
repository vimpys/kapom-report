import type { jsPDF } from 'jspdf';
import type { FontConfig } from '../font/font-config';
import { registerFonts } from '../font/register-fonts';
import { nativeNumeric } from '../numeric/numeric-strategy';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { ResolvedTheme, ThemeInput } from '../theme/theme';
import { resolveTheme } from '../theme/theme';
import type { DeepPartial } from '../types/primitives';
import type { Typography } from '../types/typography';
import { resolveTypography } from '../types/typography';
import type {
  MeasurableBlock,
  MeasureContext,
  PageMargins,
  RenderContext,
} from './context';
import { buildConfinedContext } from './confined-context';
import { PdfCursor } from './cursor';
import { drawText } from './draw-text';
import type { PageBandLike } from './page-band';
import { isBlockBand } from './page-band';
import { deriveMeasureContext, measureBlocksHeight } from './measure-context';
import { measureTextBlockHeight } from './text-metrics';
import type { PageNumberInput } from './page-number';
import { renderPageNumber, resolvePageNumber } from './page-number';
import type { Watermark, WatermarkInput } from './watermark';
import { resolveWatermark } from './watermark';

export interface RenderEngineOptions {
  margins?: Partial<PageMargins>;
  numeric?: NumericStrategy;
  /** always registered before the first block renders (VFS timing) — also becomes the doc's default font */
  font?: FontConfig;
  /** font token per row-type (columnHeader/detailRow/groupHeader/...) — merges over DEFAULT_TYPOGRAPHY one token at a time */
  typography?: DeepPartial<Typography>;
  /** ready-made colour scheme (preset name or a `Theme` object) — drives every table fill; omit = the default blue/grey look */
  theme?: ThemeInput;
  /** page header repeated on every page — reserves space at the top (subtracted from the content area); drawn at finalize(). A raw render callback (PageBand) or a resolved block tree (BlockBand) */
  pageHeader?: PageBandLike;
  /** page footer repeated on every page — reserves space at the bottom; drawn at finalize() */
  pageFooter?: PageBandLike;
  /**
   * watermark repeated on every page — doesn't reserve content-area space (unlike page header/footer); drawn at finalize() before the bands
   * accepts a preset `{ text: 'DRAFT', ... }` or a full render callback (escape hatch)
   */
  watermark?: WatermarkInput;
  /**
   * a lightweight page-number annotation drawn inside the existing page margin — unlike
   * pageHeader/pageFooter, this never reserves content-area space; `true` for the default
   * (bottom-left, '{pageNumber} / {totalPages}'), a position string shorthand, or a full object
   */
  pageNumber?: PageNumberInput;
}

/** in the doc's units — 15 suits a doc in mm (jsPDF's default); a doc in pt units should override this */
export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 15,
  bottom: 15,
  left: 15,
  right: 15,
};

/**
 * Whether a per-page decoration is drawn on this page: it has to exist at all, and it has to show
 * on page 1 if that's the page in question (every later page always shows it). A decoration that
 * didn't opt in or out falls back to its own default — a watermark stays off, a header/footer band
 * stays on.
 *
 * Both halves live here deliberately, and the existence half is what the type predicate reports, so
 * a caller can pass the decoration straight on afterwards. Splitting them and reaching for optional
 * chaining on the flag (`showsOnFirstPage(this.pageHeader?.showOnFirstPage, true)`) reads like it
 * should work and does not: `?.` yields undefined, which `??` then reads as "unspecified, use the
 * default" — so "there is no header" and "there is a header that didn't set the flag" collapse into
 * the same answer, and the condition is true even when there is nothing to draw.
 */
function drawsOnPage<T extends { showOnFirstPage?: boolean }>(
  decoration: T | undefined,
  page: number,
  byDefault: boolean,
): decoration is T {
  if (!decoration) return false;
  return page > 1 || (decoration.showOnFirstPage ?? byDefault);
}

/**
 * Wraps a single jsPDF doc — manages the cursor/page-breaks centrally, injects context into every block.
 * Blocks must never call doc.addPage() themselves; request space only through ctx.ensureSpace.
 */
export class RenderEngine {
  private readonly doc: jsPDF;
  private readonly cursor: PdfCursor;
  private readonly margins: PageMargins;
  private readonly numeric: NumericStrategy;
  private readonly typography: Typography;
  private readonly theme: ResolvedTheme;
  private readonly pageHeader: PageBandLike | undefined;
  private readonly pageFooter: PageBandLike | undefined;
  /** the doc's page dimensions — queried once (the lib assumes a uniform page size, like the cursor) */
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  /** resolved reserved heights — a block band with no explicit height is auto-measured here */
  private readonly headerHeight: number;
  private readonly footerHeight: number;
  private readonly watermark: Watermark | undefined;
  private readonly pageNumber: ReturnType<typeof resolvePageNumber>;
  /** the report's default font family — passed to the watermark so it never inherits ambient font state */
  private defaultFontFamily = 'helvetica';

  constructor(doc: jsPDF, options: RenderEngineOptions = {}) {
    this.doc = doc;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.margins = { ...DEFAULT_PAGE_MARGINS, ...options.margins };
    this.numeric = options.numeric ?? nativeNumeric;
    this.typography = resolveTypography(options.typography);
    this.theme = resolveTheme(options.theme);
    this.pageHeader = options.pageHeader;
    this.pageFooter = options.pageFooter;
    this.watermark = options.watermark !== undefined ? resolveWatermark(options.watermark) : undefined;
    this.pageNumber = resolvePageNumber(options.pageNumber);

    if (options.font) {
      // must happen before the first block renders — the constructor always runs before .render() anyway
      const defaultFamily = registerFonts(doc, options.font);
      doc.setFont(defaultFamily, 'normal');
      this.defaultFontFamily = defaultFamily;
    }

    // resolve band heights after fonts are registered (auto-measure needs the real font metrics)
    // and before the cursor is built (it reserves these heights from the content area)
    this.headerHeight = this.pageHeader ? this.resolveBandHeight(this.pageHeader) : 0;
    this.footerHeight = this.pageFooter ? this.resolveBandHeight(this.pageFooter) : 0;

    this.cursor = new PdfCursor({
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      margins: this.margins,
      headerHeight: this.headerHeight,
      footerHeight: this.footerHeight,
      onPageBreak: () => {
        this.doc.addPage();
      },
    });
  }

  /** a block band with no explicit height = auto-measured (sum of its blocks); otherwise the given height */
  private resolveBandHeight(band: PageBandLike): number {
    if (isBlockBand(band)) {
      return band.height ?? this.measureBandHeight(band.blocks);
    }

    return band.height;
  }

  /** total natural height of a band's blocks — a MeasureContext that doesn't need the cursor (built before it, so contentWidth is derived from pageWidth rather than cursor.contentWidth) */
  private measureBandHeight(blocks: readonly MeasurableBlock[]): number {
    const measureCtx: MeasureContext = {
      pageWidth: this.pageWidth,
      contentWidth: this.pageWidth - this.margins.left - this.margins.right,
      numeric: this.numeric,
      typography: this.typography,
      measureText: (text, fontSize, maxWidth) => measureTextBlockHeight(this.doc, text, fontSize, maxWidth),
    };
    return measureBlocksHeight(blocks, measureCtx);
  }

  /**
   * renders in order: measure → ensureSpace (auto page-break) → render
   * keep-together at the composite level is the block's own responsibility (recursive measureHeight)
   */
  render(blocks: readonly MeasurableBlock[]): void {
    // one context, derived — not two builds (createMeasureContext would build a second render context internally)
    const renderCtx = this.createRenderContext();
    const measureCtx = deriveMeasureContext(renderCtx);
    for (const block of blocks) {
      // a self-splitting block (breakable box) only needs room to start — full height otherwise
      const height = block.minStartHeight?.(measureCtx) ?? block.measureHeight(measureCtx);
      this.cursor.ensureSpace(height);
      block.render(renderCtx);
    }
  }

  /** delegates to deriveMeasureContext — MeasureContext construction logic lives in one place (single source) */
  createMeasureContext(): MeasureContext {
    return deriveMeasureContext(this.createRenderContext());
  }

  createRenderContext(): RenderContext {
    return {
      doc: this.doc,
      // PdfCursor is a live view — a block always reads the latest x/y/pageIndex via its getters
      cursor: this.cursor,
      margins: this.margins,
      contentWidth: this.cursor.contentWidth,
      contentTop: this.cursor.contentTop,
      contentBottom: this.cursor.contentBottom,
      numeric: this.numeric,
      typography: this.typography,
      theme: this.theme,
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
   * Draws the page header/footer band on every page — must be called once, after every block's
   * render() has finished (the band is drawn now rather than on page-break, because AutoTable
   * creates pages of its own, bypassing our onPageBreak — iterating every page in the real doc
   * at the end covers every page no matter who created it, and pageCount is known by then).
   * No-op if there's no band; safe to call even without one — the facade/user can always call it.
   */
  finalize(): void {
    if (!this.pageHeader && !this.pageFooter && !this.watermark && !this.pageNumber) return;

    const pageCount = this.doc.getNumberOfPages();
    const bandWidth = this.cursor.contentWidth;
    const currentPage = this.doc.getCurrentPageInfo().pageNumber;
    // the render context is stable across pages here (a confined band re-pins the cursor per call,
    // and setPage drives which page the shared doc draws to) — build it once, not per band per page
    const baseCtx = this.createRenderContext();

    for (let page = 1; page <= pageCount; page += 1) {
      this.drawPageDecorations(page, pageCount, bandWidth, baseCtx);
    }

    this.doc.setPage(currentPage); // restore the original active page, so the caller isn't confused if they draw more
  }

  /** draws every per-page decoration (watermark, header/footer bands, page number) onto one page */
  private drawPageDecorations(page: number, pageCount: number, bandWidth: number, baseCtx: RenderContext): void {
    const pageIndex = page - 1;
    this.doc.setPage(page);

    // watermark always before header/footer — so the (opaque) header/footer stays crisp on top
    if (drawsOnPage(this.watermark, page, false)) {
      this.watermark.render({
        doc: this.doc,
        pageIndex,
        pageCount,
        pageWidth: this.pageWidth,
        pageHeight: this.pageHeight,
        defaultFontFamily: this.defaultFontFamily,
        drawText: (text, x, y, opts) => drawText(this.doc, text, x, y, undefined, opts),
      });
    }

    if (drawsOnPage(this.pageHeader, page, true)) {
      this.drawBand(this.pageHeader, this.margins.top, bandWidth, pageIndex, pageCount, baseCtx);
    }

    if (drawsOnPage(this.pageFooter, page, true)) {
      const footerTop = this.pageHeight - this.margins.bottom - this.footerHeight;
      this.drawBand(this.pageFooter, footerTop, bandWidth, pageIndex, pageCount, baseCtx);
    }

    // pageNumber is already fully resolved (showOnFirstPage is never undefined), so the default here is never consulted
    if (drawsOnPage(this.pageNumber, page, true)) {
      renderPageNumber(this.doc, pageIndex, pageCount, this.pageWidth, this.pageHeight, this.margins, this.pageNumber);
    }
  }

  private drawBand(
    band: PageBandLike,
    top: number,
    width: number,
    pageIndex: number,
    pageCount: number,
    baseCtx: RenderContext,
  ): void {
    if (isBlockBand(band)) {
      // render the block tree into the band's reserved rect via a confined context (cursor pinned
      // to the band's top-left, ensureSpace a no-op) — the doc is already on the right page (setPage)
      const ctx = buildConfinedContext(baseCtx, this.margins.left, width, top, 'page band');
      for (const block of band.blocks) {
        block.render(ctx);
      }

      return;
    }

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
