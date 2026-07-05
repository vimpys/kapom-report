import type { jsPDF } from 'jspdf';
import { assertThaiRenderable } from './font-guard';
import { normalizeText } from './text-normalizer';
import type { TextNormalizeOptions } from './text-normalizer';

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
