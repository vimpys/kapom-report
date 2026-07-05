import { describe, expect, it, vi } from 'vitest';
import type { PageMargins } from '../src/core/context';
import { PdfCursor } from '../src/core/cursor';
import { KapomLayoutError } from '../src/core/errors';

const margins: PageMargins = { top: 15, bottom: 15, left: 15, right: 15 };

// A4 mm: content area 180 × 267
const makeCursor = (onPageBreak?: (newPageIndex: number) => void) =>
  new PdfCursor(
    onPageBreak
      ? { pageWidth: 210, pageHeight: 297, margins, onPageBreak }
      : { pageWidth: 210, pageHeight: 297, margins },
  );

describe('PdfCursor — initial state', () => {
  it('เริ่มที่มุมบนซ้ายของ content area หน้าแรก', () => {
    const cursor = makeCursor();
    expect(cursor.x).toBe(15);
    expect(cursor.y).toBe(15);
    expect(cursor.pageIndex).toBe(0);
    expect(cursor.isAtTopOfPage).toBe(true);
  });

  it('คำนวณ contentWidth / contentHeight / remainingHeight จาก margin', () => {
    const cursor = makeCursor();
    expect(cursor.contentWidth).toBe(180);
    expect(cursor.contentHeight).toBe(267);
    expect(cursor.remainingHeight).toBe(267);
  });
});

describe('PdfCursor — validation', () => {
  it('margin ติดลบ → throw KapomLayoutError', () => {
    expect(
      () =>
        new PdfCursor({
          pageWidth: 210,
          pageHeight: 297,
          margins: { ...margins, top: -1 },
        }),
    ).toThrow(KapomLayoutError);
  });

  it('margin กินพื้นที่จนไม่เหลือ content area → throw', () => {
    expect(
      () =>
        new PdfCursor({
          pageWidth: 210,
          pageHeight: 297,
          margins: { top: 150, bottom: 150, left: 15, right: 15 },
        }),
    ).toThrow(KapomLayoutError);
    expect(
      () =>
        new PdfCursor({
          pageWidth: 210,
          pageHeight: 297,
          margins: { top: 15, bottom: 15, left: 105, right: 105 },
        }),
    ).toThrow(KapomLayoutError);
  });

  it('pageWidth/pageHeight ไม่ valid → throw', () => {
    expect(
      () => new PdfCursor({ pageWidth: 0, pageHeight: 297, margins }),
    ).toThrow(KapomLayoutError);
    expect(
      () => new PdfCursor({ pageWidth: 210, pageHeight: Number.NaN, margins }),
    ).toThrow(KapomLayoutError);
  });
});

describe('PdfCursor — advanceY', () => {
  it('เลื่อน y ลงและลด remainingHeight', () => {
    const cursor = makeCursor();
    cursor.advanceY(100);
    expect(cursor.y).toBe(115);
    expect(cursor.remainingHeight).toBe(167);
    expect(cursor.isAtTopOfPage).toBe(false);
  });

  it('ค่าติดลบ/NaN → throw KapomLayoutError', () => {
    const cursor = makeCursor();
    expect(() => cursor.advanceY(-1)).toThrow(KapomLayoutError);
    expect(() => cursor.advanceY(Number.NaN)).toThrow(KapomLayoutError);
  });

  it('advanceY(0) เป็น no-op ที่ถูกกฎ', () => {
    const cursor = makeCursor();
    cursor.advanceY(0);
    expect(cursor.y).toBe(15);
  });
});

describe('PdfCursor — ensureSpace / page-break', () => {
  it('พื้นที่พอ → ไม่ break, คืน false', () => {
    const cursor = makeCursor();
    cursor.advanceY(100);
    expect(cursor.ensureSpace(167)).toBe(false); // พอดีเป๊ะ
    expect(cursor.pageIndex).toBe(0);
    expect(cursor.y).toBe(115);
  });

  it('พื้นที่ไม่พอ → ขึ้นหน้าใหม่, reset cursor, คืน true', () => {
    const onPageBreak = vi.fn();
    const cursor = makeCursor(onPageBreak);
    cursor.advanceY(200);
    expect(cursor.ensureSpace(100)).toBe(true);
    expect(cursor.pageIndex).toBe(1);
    expect(cursor.y).toBe(15);
    expect(cursor.x).toBe(15);
    expect(cursor.remainingHeight).toBe(267);
    expect(onPageBreak).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('block สูงเกิน content area ทั้งหน้า + cursor อยู่หัวหน้า → ไม่ break (กัน loop ไม่รู้จบ)', () => {
    const onPageBreak = vi.fn();
    const cursor = makeCursor(onPageBreak);
    expect(cursor.ensureSpace(500)).toBe(false);
    expect(cursor.pageIndex).toBe(0);
    expect(onPageBreak).not.toHaveBeenCalled();
  });

  it('block สูงเกินหน้า แต่ cursor ไม่ได้อยู่หัวหน้า → break หนึ่งครั้งให้เริ่มหน้าใหม่', () => {
    const cursor = makeCursor();
    cursor.advanceY(50);
    expect(cursor.ensureSpace(500)).toBe(true);
    expect(cursor.pageIndex).toBe(1);
    // หน้าใหม่ยังไม่พออยู่ดี → เรียกซ้ำต้องไม่ break อีก
    expect(cursor.ensureSpace(500)).toBe(false);
    expect(cursor.pageIndex).toBe(1);
  });

  it('ค่าติดลบ/NaN → throw KapomLayoutError', () => {
    const cursor = makeCursor();
    expect(() => cursor.ensureSpace(-1)).toThrow(KapomLayoutError);
    expect(() => cursor.ensureSpace(Number.NaN)).toThrow(KapomLayoutError);
  });

  it('syncTo: ตาม doc ที่ block วาดข้ามหน้าเอง — ไม่ fire onPageBreak', () => {
    const onPageBreak = vi.fn();
    const cursor = makeCursor(onPageBreak);

    cursor.syncTo(2, 150);

    expect(cursor.pageIndex).toBe(2);
    expect(cursor.y).toBe(150);
    expect(cursor.x).toBe(15);
    expect(onPageBreak).not.toHaveBeenCalled();
  });

  it('syncTo: หน้าเดิมได้ แต่ถอยหลัง/ค่าไม่ valid → throw', () => {
    const cursor = makeCursor();
    cursor.syncTo(1, 100);

    expect(() => cursor.syncTo(1, 120)).not.toThrow();
    expect(() => cursor.syncTo(0, 50)).toThrow(KapomLayoutError);
    expect(() => cursor.syncTo(1.5, 50)).toThrow(KapomLayoutError);
    expect(() => cursor.syncTo(2, Number.NaN)).toThrow(KapomLayoutError);
    expect(() => cursor.syncTo(2, -5)).toThrow(KapomLayoutError);
  });

  it('break ต่อเนื่องหลายหน้า → pageIndex นับสะสม, callback ได้ index ใหม่ทุกครั้ง', () => {
    const indices: number[] = [];
    const cursor = makeCursor((i) => indices.push(i));
    for (let page = 1; page <= 3; page += 1) {
      cursor.advanceY(250);
      cursor.ensureSpace(100);
    }
    expect(cursor.pageIndex).toBe(3);
    expect(indices).toEqual([1, 2, 3]);
  });
});
