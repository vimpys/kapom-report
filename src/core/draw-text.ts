import type { jsPDF } from 'jspdf';
import { normalizeText } from './text-normalizer';
import type { TextNormalizeOptions } from './text-normalizer';

/**
 * จุดเดียวที่อนุญาตให้เรียก doc.text() ตรง (facade pattern ตาม decision) —
 * ทุก block ต้องวาด text ผ่านนี้แทน ให้ normalizeText รับประกันเสมอไม่ว่า
 * ต้นทางจะลืม normalize เองมาก่อนหรือไม่ (defense-in-depth ที่ boundary)
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
  doc.text(normalized, x, y);
}
