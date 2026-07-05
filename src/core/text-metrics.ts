import type { jsPDF } from 'jspdf';

/**
 * ตัดบรรทัดผ่าน jsPDF จริง (splitTextToSize อ่าน fontSize ปัจจุบันของ doc)
 * set/restore fontSize รอบเรียกเสมอ — ห้ามทิ้ง side effect ไว้บน doc
 */
export function splitTextLines(
  doc: jsPDF,
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const previousSize = doc.getFontSize();
  doc.setFontSize(fontSize);
  // jspdf ประกาศ return เป็น any → รับเป็น unknown แล้ว narrow
  const split: unknown = doc.splitTextToSize(text, maxWidth);
  doc.setFontSize(previousSize);
  return Array.isArray(split) ? (split as string[]) : [text];
}

/** ความสูงต่อบรรทัดในหน่วยของ doc — fontSize เป็น pt เสมอ ต้องหาร scaleFactor แปลงหน่วย */
export function lineHeightOf(doc: jsPDF, fontSize: number): number {
  return (fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
}

/** ความสูงรวมของ text block — single source of truth ให้ทั้ง measure และ render เรียกใช้ */
export function measureTextBlockHeight(
  doc: jsPDF,
  text: string,
  fontSize: number,
  maxWidth: number,
): number {
  const lines = splitTextLines(doc, text, fontSize, maxWidth);
  return lines.length * lineHeightOf(doc, fontSize);
}
