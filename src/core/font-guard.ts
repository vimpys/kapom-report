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
    `Thai text ("${preview}") is about to be rendered with '${fontName}', a jsPDF built-in font ` +
      `with no Thai glyphs — the output would be garbled without any error from jsPDF itself. ` +
      `Register a Thai font via the font config (e.g. Sarabun), or change the text/label to a ` +
      `language the font supports (note: summaryLabel/footerLabel default to Thai 'รวม' — override them in English).`,
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
