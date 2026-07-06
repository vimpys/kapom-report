import { GState } from 'jspdf';
import type { jsPDF } from 'jspdf';
import { KapomError } from './errors';
import type { RGB } from '../types/primitives';

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

export const DEFAULT_WATERMARK_OPACITY = 0.15;
export const DEFAULT_WATERMARK_FONT_SIZE = 60;
export const DEFAULT_WATERMARK_COLOR: RGB = [150, 150, 150];

/**
 * declarative preset (ค้างแก้ #2 จาก code review) — แค่ระบุข้อความก็ได้ตรากลางหน้า
 * ทุกหน้าโดยไม่ต้องเขียน render callback / รู้จัก jsPDF เลย (pattern เดียวกับ
 * createAnchoredBand ที่แก้ให้ PageBand); ต้องการมากกว่านี้ค่อยหลุดไป Watermark เต็มรูป
 */
export interface TextWatermark {
  text: string;
  /** ความจาง 0-1 — default 0.15 */
  opacity?: number;
  /** pt — default 60 */
  fontSize?: number;
  /** default เทา [150,150,150] */
  color?: RGB;
  /** วาดบนหน้าแรกด้วยไหม — default true */
  showOnFirstPage?: boolean;
}

/** config ที่ engine/facade รับ — preset ข้อความ หรือ render callback เต็มรูป (escape hatch) */
export type WatermarkInput = Watermark | TextWatermark;

function isTextWatermark(input: WatermarkInput): input is TextWatermark {
  return 'text' in input;
}

/** แปลง WatermarkInput เป็น Watermark ที่ engine ใช้ — validate fail-fast ตอน resolve (ก่อน render) */
export function resolveWatermark(input: WatermarkInput): Watermark {
  if (!isTextWatermark(input)) return input;

  const { text } = input;
  const opacity = input.opacity ?? DEFAULT_WATERMARK_OPACITY;
  const fontSize = input.fontSize ?? DEFAULT_WATERMARK_FONT_SIZE;
  const color = input.color ?? DEFAULT_WATERMARK_COLOR;

  if (text.trim() === '') {
    throw new KapomError('watermark: text must not be empty');
  }
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new KapomError(`watermark: opacity must be between 0 and 1 (got ${opacity})`);
  }
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new KapomError(`watermark: fontSize must be a positive number (got ${fontSize})`);
  }

  return {
    ...(input.showOnFirstPage !== undefined ? { showOnFirstPage: input.showOnFirstPage } : {}),
    render: (ctx) => {
      withOpacity(ctx.doc, opacity, () => {
        ctx.doc.setFontSize(fontSize);
        const [r, g, b] = color;
        ctx.doc.setTextColor(r, g, b);
        // จัดกึ่งกลางจริงด้วยความกว้างที่วัดได้ (ไม่ใช่ offset เดา) — วัดหลัง setFontSize เสมอ
        const textWidth = ctx.doc.getTextWidth(text);
        ctx.drawText(text, (ctx.pageWidth - textWidth) / 2, ctx.pageHeight / 2);
      });
    },
  };
}
