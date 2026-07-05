import type { CursorState, PageMargins } from './context';
import { KapomLayoutError } from './errors';

export interface PdfCursorOptions {
  /** ขนาดหน้าในหน่วยของ doc (จาก doc.internal.pageSize) */
  pageWidth: number;
  pageHeight: number;
  margins: PageMargins;
  /**
   * โซนสงวนของ page header/footer — หักจาก content area เสมอ (content เริ่มใต้ header
   * จบเหนือ footer) ไม่ว่า band จะถูกวาดเมื่อไหร่; default 0 = ไม่มี band
   */
  headerHeight?: number;
  footerHeight?: number;
  /** เรียกหลัง cursor ขึ้นหน้าใหม่แล้ว — engine ใช้ sync doc.addPage() */
  onPageBreak?: (newPageIndex: number) => void;
}

/**
 * x/y tracking + page-break decision — pure logic ไม่แตะ jsPDF
 * engine เชื่อมกับ doc ผ่าน onPageBreak เท่านั้น → test ได้โดยไม่ mock jsPDF
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
      throw new KapomLayoutError(`pageWidth ต้องเป็นค่าบวก (ได้ ${pageWidth})`);
    }
    if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
      throw new KapomLayoutError(`pageHeight ต้องเป็นค่าบวก (ได้ ${pageHeight})`);
    }
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const value = margins[side];
      if (!Number.isFinite(value) || value < 0) {
        throw new KapomLayoutError(`margin.${side} ต้องเป็นค่า >= 0 (ได้ ${value})`);
      }
    }
    for (const [name, value] of [['headerHeight', headerHeight], ['footerHeight', footerHeight]] as const) {
      if (!Number.isFinite(value) || value < 0) {
        throw new KapomLayoutError(`${name} ต้องเป็นค่า >= 0 (ได้ ${value})`);
      }
    }
    if (pageWidth - margins.left - margins.right <= 0) {
      throw new KapomLayoutError('margin ซ้าย+ขวา กินพื้นที่เกินความกว้างหน้า — ไม่เหลือ content area');
    }
    if (pageHeight - margins.top - margins.bottom - headerHeight - footerHeight <= 0) {
      throw new KapomLayoutError('margin + header/footer reserved กินพื้นที่เกินความสูงหน้า — ไม่เหลือ content area');
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

  /** ขอบบนของ content area (ใต้ header reserved) — จุดเริ่ม y ของทุกหน้า */
  get contentTop(): number {
    return this.margins.top + this.headerHeight;
  }

  /** ขอบล่างของ content area (เหนือ footer reserved) */
  get contentBottom(): number {
    return this.pageHeight - this.margins.bottom - this.footerHeight;
  }

  /** ความสูง content area เต็มหน้า (ไม่ขึ้นกับตำแหน่ง cursor) — หัก header/footer reserved แล้ว */
  get contentHeight(): number {
    return this.contentBottom - this.contentTop;
  }

  /** พื้นที่แนวตั้งที่เหลือจาก cursor ถึงขอบล่าง content area */
  get remainingHeight(): number {
    return this.contentBottom - this.currentY;
  }

  get isAtTopOfPage(): boolean {
    return this.currentY === this.contentTop;
  }

  advanceY(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new KapomLayoutError(`advanceY ต้องเป็นค่า >= 0 (ได้ ${amount})`);
    }
    this.currentY += amount;
  }

  /**
   * ขึ้นหน้าใหม่ถ้าพื้นที่ที่เหลือไม่พอ requiredHeight
   * @returns true ถ้าขึ้นหน้าใหม่
   *
   * block ที่สูงเกิน content area ทั้งหน้า (เช่น table ยาว) จะไม่ break ที่นี่ —
   * ถ้า cursor อยู่หัวหน้าแล้ว break ก็ไม่ช่วย → block ต้องจัดการ break ภายในเอง
   */
  ensureSpace(requiredHeight: number): boolean {
    if (!Number.isFinite(requiredHeight) || requiredHeight < 0) {
      throw new KapomLayoutError(`ensureSpace ต้องเป็นค่า >= 0 (ได้ ${requiredHeight})`);
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
   * sync state ตาม doc จริง หลัง block วาดข้ามหน้าเอง (เช่น AutoTable)
   * ไม่ fire onPageBreak — หน้าใน doc ถูกเพิ่มไปแล้วโดยตัว block
   * ถอยหลังไม่ได้ (pageIndex ต้อง >= ปัจจุบัน) — render เดินหน้าอย่างเดียว
   */
  syncTo(pageIndex: number, y: number): void {
    if (!Number.isInteger(pageIndex) || pageIndex < this.currentPageIndex) {
      throw new KapomLayoutError(
        `syncTo: pageIndex ต้องเป็นจำนวนเต็ม >= หน้าปัจจุบัน ${this.currentPageIndex} (ได้ ${pageIndex})`,
      );
    }
    if (!Number.isFinite(y) || y < 0) {
      throw new KapomLayoutError(`syncTo: y ต้องเป็นค่า >= 0 (ได้ ${y})`);
    }
    this.currentPageIndex = pageIndex;
    this.currentY = y;
    this.currentX = this.margins.left;
  }
}
