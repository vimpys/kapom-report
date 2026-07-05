import type { jsPDF } from 'jspdf';
import { vi } from 'vitest';

/** pt → mm — jsPDF default unit เป็น mm, fontSize เป็น pt เสมอ */
export const SCALE_FACTOR = 72 / 25.4;

/**
 * stub เฉพาะ surface ที่ core/blocks แตะจริง — A4 mm
 * ใช้ร่วมกันทั้ง engine/block tests กันโค้ด stub กระจัดกระจาย
 */
export function makeStubDoc(splitInto: string[] = ['line1']) {
  const state = { fontSize: 16, font: { fontName: 'helvetica', fontStyle: 'normal' } };

  const stub = {
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      scaleFactor: SCALE_FACTOR,
    },
    addPage: vi.fn(),
    getFontSize: vi.fn((): number => state.fontSize),
    setFontSize: vi.fn((size: number): void => {
      state.fontSize = size;
    }),
    getFont: vi.fn(() => ({ ...state.font })),
    setFont: vi.fn((fontName: string, fontStyle?: string): void => {
      state.font = { fontName, fontStyle: fontStyle ?? state.font.fontStyle };
    }),
    getLineHeightFactor: vi.fn(() => 1.15),
    splitTextToSize: vi.fn((): string[] => splitInto),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    /** ความกว้างจำลอง: 2 หน่วยต่อตัวอักษร — พอสำหรับทดสอบสัดส่วน column width */
    getTextWidth: vi.fn((text: string): number => text.length * 2),
  };

  return { stub, doc: stub as unknown as jsPDF };
}
