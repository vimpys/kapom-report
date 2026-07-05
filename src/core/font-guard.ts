import type { jsPDF } from 'jspdf';
import { KapomFontError } from './errors';

/** standard 14 fonts ที่ jsPDF มีในตัว — ไม่มี glyph ไทยแน่นอน */
const BUILTIN_STANDARD_FONTS = new Set(['helvetica', 'courier', 'times', 'symbol', 'zapfdingbats']);

/** Thai block U+0E00-U+0E7F — ครอบพยัญชนะ/สระ/วรรณยุกต์/เลขไทย */
const THAI_CHAR = /[\u0E00-\u0E7F]/;

export function containsThai(text: string): boolean {
  return THAI_CHAR.test(text);
}

/** font ที่มากับ jsPDF เอง (ตรงข้ามกับ font ที่ user ลงทะเบียนผ่าน addFont) */
export function isBuiltinStandardFont(fontName: string): boolean {
  return BUILTIN_STANDARD_FONTS.has(fontName.toLowerCase());
}

export function thaiGlyphError(fontName: string, sample: string): KapomFontError {
  const preview = sample.length > 40 ? `${sample.slice(0, 40)}…` : sample;
  return new KapomFontError(
    `พบข้อความภาษาไทย ("${preview}") แต่ font ปัจจุบันคือ '${fontName}' ซึ่งเป็น built-in ของ jsPDF ` +
      `ที่ไม่มี glyph ไทย — ผลลัพธ์จะเป็นตัวอักษรเละโดยไม่มี error จาก jsPDF เอง; ` +
      `ลงทะเบียนฟอนต์ไทยผ่าน font config (เช่น Sarabun) หรือเปลี่ยนข้อความ/label เป็นภาษาที่ font รองรับ ` +
      `(เช่น summaryLabel/footerLabel default เป็น 'รวม' — override เป็นภาษาอังกฤษได้)`,
  );
}

/**
 * fail-fast กัน silent mojibake (ค้างแก้ #1 จาก code review): ข้อความไทย + font built-in
 * ของ jsPDF = เละแน่นอนแบบเงียบๆ — throw พร้อมทางแก้แทน ตรง decision เรื่อง font
 * validate fail-fast; font ที่ user ลงทะเบียนเองถือว่ารองรับ (ตรวจ glyph coverage จริง
 * ต้อง parse ตาราง cmap ของ TTF — แพงเกินไปสำหรับ guard ที่รันทุกครั้งที่วาด)
 */
export function assertThaiRenderable(doc: jsPDF, text: string): void {
  if (!containsThai(text)) return;
  const fontName = doc.getFont().fontName;
  if (!isBuiltinStandardFont(fontName)) return;
  throw thaiGlyphError(fontName, text);
}
