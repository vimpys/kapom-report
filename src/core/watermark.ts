import { GState } from 'jspdf';
import type { jsPDF } from 'jspdf';

export interface WatermarkContext {
  readonly doc: jsPDF;
  /** 0-based — นับต่อเนื่องทั้ง document */
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** วาด text ผ่าน normalizer facade (จุดเดียวที่อนุญาตให้ watermark แตะ text) */
  readonly drawText: (text: string, x: number, y: number) => void;
}

export type WatermarkRenderer = (ctx: WatermarkContext) => void;

/**
 * วาดซ้ำทุกหน้า ไม่หักพื้นที่ content (ต่าง PageBand ที่หัก contentTop/contentBottom) — วาดตอน
 * finalize() หลัง content ทุกหน้าจบแล้ว ด้วยเหตุผลเดียวกับ PageBand (AutoTable สร้างหน้าเองข้าม
 * onPageBreak ของ engine) แปลว่าทางกลไกจริง watermark วาด "ทับ" content เสมอ (jsPDF ไม่มี
 * z-order — วาดทีหลังคือทับ) ผู้ใช้ต้องคุม opacity เอง (เช่น `doc.setGState(new jsPDF.GState({opacity: 0.15}))`
 * ก่อนวาด แล้ว reset กลับ 1 หลังวาด) ให้ "ดูเหมือน" อยู่ใต้ content ทางสายตา — raw `doc` access
 * ระดับเดียวกับ escape hatch ของ Raw block/PageBand
 */
export interface Watermark {
  render: WatermarkRenderer;
  /** วาดบนหน้าแรกด้วยไหม — default true */
  showOnFirstPage?: boolean;
}

/**
 * helper คุม opacity รอบการวาด — set GState opacity ก่อนเรียก draw แล้ว reset กลับ 1 เสมอ
 * ให้ watermark renderer ไม่ต้อง import GState จาก jspdf เอง (ใช้งานง่ายขึ้น จุดประสงค์
 * เดียวกับ drawText facade); ค่านอกช่วง 0-1 → clamp โดย jsPDF เอง
 */
export function withOpacity(doc: jsPDF, opacity: number, draw: () => void): void {
  doc.setGState(new GState({ opacity }));
  try {
    draw();
  } finally {
    doc.setGState(new GState({ opacity: 1 }));
  }
}
