import type { jsPDF } from 'jspdf';

/**
 * context ที่ band renderer ได้รับ — วาดในโซนสงวน (header/footer) ของหน้าหนึ่ง
 * band วาดตอน finalize (หลัง render จบ) จึงรู้ pageCount จริงแล้ว → รองรับ "หน้า X / Y"
 */
export interface PageBandContext {
  readonly doc: jsPDF;
  /** 0-based — นับต่อเนื่องทั้ง document */
  readonly pageIndex: number;
  readonly pageCount: number;
  /** rectangle ของโซน band (x,y = มุมบนซ้าย) ในหน่วยของ doc */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** วาด text ผ่าน normalizer facade (จุดเดียวที่อนุญาตให้ band แตะ text) */
  readonly drawText: (text: string, x: number, y: number) => void;
}

export type PageBandRenderer = (ctx: PageBandContext) => void;

/**
 * page header/footer — ซ้ำทุกหน้า, กินพื้นที่สงวน (reserved height) นอก content flow
 * height หักจาก content area เสมอ; render() วาดในโซนนั้นตอน finalize
 */
export interface PageBand {
  height: number;
  render: PageBandRenderer;
  /** วาดบนหน้าแรกด้วยไหม — default true */
  showOnFirstPage?: boolean;
}
