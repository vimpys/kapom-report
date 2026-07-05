import type { jsPDF } from 'jspdf';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { Typography } from '../types/typography';

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** cursor state — อ่านอย่างเดียวจากภายนอก block */
export interface CursorState {
  readonly x: number;
  readonly y: number;
  readonly pageIndex: number;
}

/** context ตอน measure — block บอกความสูงโดยยังไม่วาด (ไม่แตะ doc state) */
export interface MeasureContext {
  readonly pageWidth: number;
  readonly contentWidth: number;
  readonly numeric: NumericStrategy;
  readonly typography: Typography;
  /** วัด text จริงผ่าน jsPDF โดยไม่วาด (splitTextToSize/getTextWidth) */
  readonly measureText: (text: string, fontSize: number, maxWidth: number) => number;
}

/** context ตอน render — block วาดลง doc; cursor คุมโดย engine */
export interface RenderContext {
  readonly doc: jsPDF;
  readonly cursor: CursorState;
  readonly margins: PageMargins;
  readonly contentWidth: number;
  /** ขอบบน content area (ใต้ page-header reserved) — absolute Y; block ที่แบ่งหน้าเอง (AutoTable) ต้องใช้กันวาดทับ band */
  readonly contentTop: number;
  /** ขอบล่าง content area (เหนือ page-footer reserved) — absolute Y */
  readonly contentBottom: number;
  readonly numeric: NumericStrategy;
  readonly typography: Typography;
  /** engine จัดการ page-break — block เรียกเพื่อ advance y */
  readonly advanceY: (amount: number) => void;
  readonly ensureSpace: (requiredHeight: number) => void;
  /**
   * สำหรับ block ที่วาดข้ามหน้าด้วยตัวเอง (เช่น AutoTable) — แจ้ง engine
   * ว่า doc ไปจบที่หน้า/ตำแหน่งไหน; pageIndex เป็น 0-based ถอยหลังไม่ได้
   */
  readonly syncCursor: (pageIndex: number, y: number) => void;
}

/**
 * Contract กลางของทุก block — ต้องตอบได้ 2 อย่าง: สูงเท่าไหร่ + วาดยังไง
 * text/image/table/group/report ทั้งหมด implement interface นี้เหมือนกัน
 */
export interface MeasurableBlock {
  /** ความสูงรวม (recursive สำหรับ composite เช่น group/nested) */
  measureHeight(ctx: MeasureContext): number;
  /** วาดลง doc; ห้ามคำนวณ page-break เอง — ใช้ ctx.ensureSpace */
  render(ctx: RenderContext): void;
}
