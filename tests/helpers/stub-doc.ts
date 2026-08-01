import type { jsPDF } from 'jspdf';
import { vi } from 'vitest';

/** pt → mm — jsPDF default unit เป็น mm, fontSize เป็น pt เสมอ */
export const SCALE_FACTOR = 72 / 25.4;

/**
 * stub เฉพาะ surface ที่ core/blocks แตะจริง — A4 mm
 * ใช้ร่วมกันทั้ง engine/block tests กันโค้ด stub กระจัดกระจาย
 */
export function makeStubDoc(splitInto: string[] = ['line1']) {
  const state = {
    fontSize: 16,
    font: { fontName: 'helvetica', fontStyle: 'normal' },
    pageCount: 1,
    currentPage: 1,
  };

  const stub = {
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      scaleFactor: SCALE_FACTOR,
    },
    addPage: vi.fn((): void => {
      state.pageCount += 1;
      state.currentPage = state.pageCount;
    }),
    getNumberOfPages: vi.fn((): number => state.pageCount),
    getCurrentPageInfo: vi.fn(() => ({ pageNumber: state.currentPage })),
    setPage: vi.fn((page: number): void => {
      state.currentPage = page;
    }),
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
    // ให้ signature เพื่อให้ `stub.text.mock.calls[n][0]` มี type จริง ไม่ใช่ any (type-aware lint จับ)
    text: vi.fn<(text: string | string[], x: number, y: number, options?: unknown) => void>(),
    addImage: vi.fn(),
    /** ความกว้างจำลอง: 2 หน่วยต่อตัวอักษร — พอสำหรับทดสอบสัดส่วน column width */
    getTextWidth: vi.fn((text: string): number => text.length * 2),
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
  };

  return { stub, doc: stub as unknown as jsPDF };
}
