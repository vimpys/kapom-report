import type { CursorState, PageMargins } from './context';
import { KapomLayoutError } from './errors';

export interface PdfCursorOptions {
  /** page size in the doc's units (from doc.internal.pageSize) */
  pageWidth: number;
  pageHeight: number;
  margins: PageMargins;
  /**
   * reserved zone for the page header/footer — always subtracted from the content area
   * (content starts below the header, ends above the footer) regardless of when the band
   * is actually drawn; default 0 = no band
   */
  headerHeight?: number;
  footerHeight?: number;
  /** called after the cursor moves to a new page — the engine uses this to sync doc.addPage() */
  onPageBreak?: (newPageIndex: number) => void;
}

/**
 * x/y tracking + page-break decisions — pure logic, doesn't touch jsPDF
 * the engine connects to the doc only via onPageBreak → testable without mocking jsPDF
 */
export class PdfCursor implements CursorState {
  private currentX: number;
  private currentY: number;
  private currentPageIndex = 0;

  private readonly pageWidth: number;
  private readonly pageHeight: number;
  private readonly margins: Readonly<PageMargins>;
  private readonly headerHeight: number;
  private readonly footerHeight: number;
  private readonly onPageBreak: ((newPageIndex: number) => void) | undefined;

  constructor(options: PdfCursorOptions) {
    const { pageWidth, pageHeight, margins } = options;
    const headerHeight = options.headerHeight ?? 0;
    const footerHeight = options.footerHeight ?? 0;

    if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
      throw new KapomLayoutError(`pageWidth must be a positive number (got ${pageWidth})`);
    }

    if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
      throw new KapomLayoutError(`pageHeight must be a positive number (got ${pageHeight})`);
    }

    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const value = margins[side];
      if (!Number.isFinite(value) || value < 0) {
        throw new KapomLayoutError(`margin.${side} must be >= 0 (got ${value})`);
      }
    }

    for (const [name, value] of [['headerHeight', headerHeight], ['footerHeight', footerHeight]] as const) {
      if (!Number.isFinite(value) || value < 0) {
        throw new KapomLayoutError(`${name} must be >= 0 (got ${value})`);
      }
    }

    if (pageWidth - margins.left - margins.right <= 0) {
      throw new KapomLayoutError('left+right margins exceed the page width — no content area left');
    }

    if (pageHeight - margins.top - margins.bottom - headerHeight - footerHeight <= 0) {
      throw new KapomLayoutError('margins + reserved header/footer heights exceed the page height — no content area left');
    }

    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
    this.margins = margins;
    this.headerHeight = headerHeight;
    this.footerHeight = footerHeight;
    this.onPageBreak = options.onPageBreak;
    this.currentX = margins.left;
    this.currentY = margins.top + headerHeight;
  }

  get x(): number {
    return this.currentX;
  }

  get y(): number {
    return this.currentY;
  }

  get pageIndex(): number {
    return this.currentPageIndex;
  }

  get contentWidth(): number {
    return this.pageWidth - this.margins.left - this.margins.right;
  }

  /** top edge of the content area (below the reserved header) — the starting y on every page */
  get contentTop(): number {
    return this.margins.top + this.headerHeight;
  }

  /** bottom edge of the content area (above the reserved footer) */
  get contentBottom(): number {
    return this.pageHeight - this.margins.bottom - this.footerHeight;
  }

  /** full-page content area height (independent of the cursor's position) — already net of the reserved header/footer */
  get contentHeight(): number {
    return this.contentBottom - this.contentTop;
  }

  /** remaining vertical space from the cursor to the bottom edge of the content area */
  get remainingHeight(): number {
    return this.contentBottom - this.currentY;
  }

  get isAtTopOfPage(): boolean {
    return this.currentY === this.contentTop;
  }

  advanceY(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new KapomLayoutError(`advanceY requires a value >= 0 (got ${amount})`);
    }

    this.currentY += amount;
  }

  /**
   * moves to a new page if the remaining space is less than requiredHeight
   * @returns true if a new page was started
   *
   * a block taller than a full content area (e.g. a long table) won't break here —
   * if the cursor is already at the top of a page, breaking wouldn't help, so the
   * block must handle breaking internally
   */
  ensureSpace(requiredHeight: number): boolean {
    if (!Number.isFinite(requiredHeight) || requiredHeight < 0) {
      throw new KapomLayoutError(`ensureSpace requires a value >= 0 (got ${requiredHeight})`);
    }

    if (requiredHeight <= this.remainingHeight) return false;
    if (this.isAtTopOfPage) return false;
    this.breakPage();

    return true;
  }

  breakPage(): void {
    this.currentPageIndex += 1;
    this.currentY = this.contentTop;
    this.currentX = this.margins.left;
    this.onPageBreak?.(this.currentPageIndex);
  }

  /**
   * sync state to match the real doc after a block has paginated itself (e.g. AutoTable)
   * doesn't fire onPageBreak — the page was already added by the block itself
   * can't go backwards (pageIndex must be >= current) — rendering only ever moves forward
   */
  syncTo(pageIndex: number, y: number): void {
    if (!Number.isInteger(pageIndex) || pageIndex < this.currentPageIndex) {
      throw new KapomLayoutError(
        `syncTo: pageIndex must be an integer >= current page ${this.currentPageIndex} (got ${pageIndex})`,
      );
    }

    if (!Number.isFinite(y) || y < 0) {
      throw new KapomLayoutError(`syncTo: y must be >= 0 (got ${y})`);
    }

    this.currentPageIndex = pageIndex;
    this.currentY = y;
    this.currentX = this.margins.left;
  }
}
