import { describe, expect, it } from 'vitest';
import { assertFixedWidthsFit, computeColumnWidths } from '../../src/table/column-width';
import { KapomLayoutError } from '../../src/core/errors';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

// stub: getTextWidth = 2 หน่วย/ตัวอักษร, padding = 10/SCALE_FACTOR ต่อ column
const PAD = 10 / SCALE_FACTOR;

describe('computeColumnWidths', () => {
  it('scale ให้รวมพอดี contentWidth ตามสัดส่วนความกว้างธรรมชาติ', () => {
    const { doc } = makeStubDoc();
    const widths = computeColumnWidths(
      doc,
      [
        ['aaaa', 'aaaaaaaa'], // 8 กับ 16 หน่วย + pad
      ],
      [undefined, undefined],
      100,
    );

    expect(widths).toHaveLength(2);
    const total = (widths[0] ?? 0) + (widths[1] ?? 0);
    expect(total).toBeCloseTo(100, 6);
    // สัดส่วนตามความกว้างธรรมชาติ: (8+pad) : (16+pad)
    const expectedRatio = (8 + PAD) / (16 + PAD);
    expect((widths[0] ?? 0) / (widths[1] ?? 0)).toBeCloseTo(expectedRatio, 6);
  });

  it('column ที่ user fix width ไม่ถูก scale — เฉพาะที่เหลือถูกยืด/หด', () => {
    const { doc } = makeStubDoc();
    const widths = computeColumnWidths(
      doc,
      [['xx', 'yy', 'zz']],
      [30, undefined, undefined],
      100,
    );

    expect(widths[0]).toBe(30);
    const flexTotal = (widths[1] ?? 0) + (widths[2] ?? 0);
    expect(flexTotal).toBeCloseTo(70, 6);
  });

  it('วัดบรรทัดยาวสุดใน cell หลายบรรทัด และข้าม cell ว่าง', () => {
    const { doc } = makeStubDoc();
    const widths = computeColumnWidths(
      doc,
      [
        ['short\nlongerline', ''],
        ['', 'abc'],
      ],
      [undefined, undefined],
      1000, // กว้างพอไม่ต้อง scale... แต่ flex จะถูกยืดเต็ม
      // ยืดเต็ม 1000 → ตรวจแค่สัดส่วน
    );

    const ratio = (widths[0] ?? 0) / (widths[1] ?? 0);
    // 'longerline' = 10 ตัว × 2 = 20 vs 'abc' = 6
    expect(ratio).toBeCloseTo((20 + PAD) / (6 + PAD), 6);
  });

  it('restore fontSize เดิมหลังวัดเสมอ', () => {
    const { stub, doc } = makeStubDoc();
    computeColumnWidths(doc, [['x']], [undefined], 100);

    const calls = stub.setFontSize.mock.calls.map((args) => args[0]);
    expect(calls).toEqual([10, 16]);
  });

  it('วัดที่ fontSize ที่ส่งเข้ามา (typography.detailRow) ไม่ hardcode 10 (ค้างแก้ #3)', () => {
    const { stub, doc } = makeStubDoc();
    computeColumnWidths(doc, [['x']], [undefined], 100, 14);

    const calls = stub.setFontSize.mock.calls.map((args) => args[0]);
    expect(calls).toEqual([14, 16]); // วัดที่ 14 แล้ว restore 16 เดิม
  });
});

describe('assertFixedWidthsFit — fixed width ที่เกินหน้าต้อง throw ไม่ใช่ล้นเงียบ', () => {
  it('fixed รวมเกิน contentWidth (ทุก column fixed) → throw KapomLayoutError', () => {
    expect(() => assertFixedWidthsFit([100, 100], 180)).toThrow(KapomLayoutError);
    expect(() => assertFixedWidthsFit([100, 100], 180)).toThrow(/100 \+ 100.*total 200.*only 180/);
  });

  it('fixed รวมพอดี contentWidth: ok ถ้าทุก column fixed, throw ถ้ายังมี auto column เหลือ', () => {
    expect(() => assertFixedWidthsFit([90, 90], 180)).not.toThrow();
    // auto column ไม่เหลือที่ให้วาดเลย
    expect(() => assertFixedWidthsFit([90, 90, undefined], 180)).toThrow(/auto-width column/);
  });

  it('fixed น้อยกว่า contentWidth → ผ่านทั้งกรณีมีและไม่มี auto column', () => {
    expect(() => assertFixedWidthsFit([50, 50], 180)).not.toThrow();
    expect(() => assertFixedWidthsFit([50, undefined], 180)).not.toThrow();
  });

  it('ไม่มี fixed เลย → ไม่ต้องเช็ค', () => {
    expect(() => assertFixedWidthsFit([undefined, undefined], 10)).not.toThrow();
    expect(() => assertFixedWidthsFit([], 180)).not.toThrow();
  });

  it('computeColumnWidths บังคับ guard เดียวกัน (grouped/nested เรียกผ่านตัวนี้)', () => {
    const { doc } = makeStubDoc();

    expect(() => computeColumnWidths(doc, [['a', 'b']], [120, 120], 180)).toThrow(KapomLayoutError);
  });
});
