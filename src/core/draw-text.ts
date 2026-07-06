import type { jsPDF } from 'jspdf';
import { assertThaiRenderable } from './font-guard';
import { normalizeText } from './text-normalizer';
import type { TextNormalizeOptions } from './text-normalizer';
import type { TextStyle } from '../types/primitives';

/**
 * ตั้ง fontSize/font/สี ของ doc ตาม TextStyle — จุดเดียวแทน pattern ที่เคยซ้ำใน
 * text-block/signature-block/anchor/group band (เคยเป็นต้นเหตุบั๊กสีติดค้าง demo 06);
 * fontFamily ไม่ระบุ = ใช้ font ปัจจุบันของ doc, color ไม่ระบุ = คงสีเดิมไว้
 * (caller ที่ต้องการ default ดำเสมอ ให้ส่ง `color: style.color ?? [0, 0, 0]` เอง)
 */
export function applyTextStyle(doc: jsPDF, style: TextStyle): void {
  doc.setFontSize(style.fontSize);
  doc.setFont(style.fontFamily ?? doc.getFont().fontName, style.fontStyle ?? 'normal');
  if (style.color) {
    const [r, g, b] = style.color;
    doc.setTextColor(r, g, b);
  }
}

/**
 * จุดเดียวที่อนุญาตให้เรียก doc.text() ตรง (facade pattern ตาม decision) —
 * ทุก block ต้องวาด text ผ่านนี้แทน ให้ normalizeText รับประกันเสมอไม่ว่า
 * ต้นทางจะลืม normalize เองมาก่อนหรือไม่ (defense-in-depth ที่ boundary)
 * + fail-fast ถ้าข้อความไทยกำลังจะถูกวาดด้วย font built-in ที่ไม่มี glyph ไทย
 */
export function drawText(
  doc: jsPDF,
  text: string | string[],
  x: number,
  y: number,
  options?: TextNormalizeOptions,
): void {
  const normalized = Array.isArray(text)
    ? text.map((line) => normalizeText(line, options))
    : normalizeText(text, options);
  for (const line of Array.isArray(normalized) ? normalized : [normalized]) {
    assertThaiRenderable(doc, line);
  }
  doc.text(normalized, x, y);
}
