import { describe, expect, it } from 'vitest';
import { KapomError } from '../../src/core/errors';
import { nativeNumeric } from '../../src/numeric/numeric-strategy';
import { asDecimalish, computeAggregate, isFiniteDecimalish } from '../../src/table/aggregate';

describe('asDecimalish — boundary ของทุกค่าที่เข้าระบบคำนวณ', () => {
  it('number / numeric string ปกติผ่าน และคืนค่าเดิมไม่แปลง type (DECIMAL จาก DB ต้องคง precision)', () => {
    expect(asDecimalish(42, 'ctx')).toBe(42);
    expect(asDecimalish(0, 'ctx')).toBe(0);
    expect(asDecimalish(-7.25, 'ctx')).toBe(-7.25);
    expect(asDecimalish('1234.50', 'ctx')).toBe('1234.50'); // ยังเป็น string ตัวเดิม ไม่ใช่ 1234.5
    expect(asDecimalish(' 10 ', 'ctx')).toBe(' 10 '); // whitespace รอบๆ Number() จัดการได้เอง
  });

  it('ค่าที่ไม่ใช่ number|string → throw บอก type ที่ได้', () => {
    for (const bad of [null, undefined, {}, [], true, new Date()]) {
      expect(() => asDecimalish(bad, "column 'Qty'")).toThrow(KapomError);
    }

    expect(() => asDecimalish(null, "column 'Qty'")).toThrow(/expected a number or a numeric string/);
  });

  it('string ที่ parse ไม่ได้ → throw แทนที่จะปล่อยเป็น "NaN" บนหน้ากระดาษ', () => {
    for (const bad of ['N/A', '-', 'abc', '1,234.00', '฿500', '12px']) {
      expect(() => asDecimalish(bad, "column 'Qty'")).toThrow(KapomError);
    }
  });

  it('string ว่าง/เว้นวรรค → throw (Number("") = 0 จะกลายเป็นยอดจริงเงียบๆ ในผลรวม)', () => {
    expect(() => asDecimalish('', 'ctx')).toThrow(KapomError);
    expect(() => asDecimalish('   ', 'ctx')).toThrow(KapomError);
  });

  it('number ที่ไม่ finite (NaN/Infinity) → throw ด้วย ไม่ใช่เช็คแค่ typeof', () => {
    expect(() => asDecimalish(Number.NaN, 'ctx')).toThrow(KapomError);
    expect(() => asDecimalish(Number.POSITIVE_INFINITY, 'ctx')).toThrow(KapomError);
    expect(() => asDecimalish(Number.NEGATIVE_INFINITY, 'ctx')).toThrow(KapomError);
  });

  it('ข้อความ error มี context + ค่าที่เจอจริง (ตามหาแถวที่ผิดใน report 100 หน้าได้)', () => {
    expect(() => asDecimalish('N/A', "column 'Qty' row 12")).toThrow(/column 'Qty' row 12/);
    expect(() => asDecimalish('N/A', 'ctx')).toThrow(/"N\/A"/);
  });
});

describe('isFiniteDecimalish — predicate คู่ของ asDecimalish (ไม่ throw)', () => {
  it('true เฉพาะค่าที่ asDecimalish ยอมให้ผ่าน', () => {
    for (const ok of [0, 42, -7.25, '1234.50', ' 10 ']) {
      expect(isFiniteDecimalish(ok)).toBe(true);
      expect(() => asDecimalish(ok, 'ctx')).not.toThrow();
    }
  });

  it('false ทุกค่าที่ asDecimalish จะ throw — สอง function ต้องตัดสินตรงกันเสมอ', () => {
    for (const bad of ['N/A', '', '   ', '1,234.00', Number.NaN, Number.POSITIVE_INFINITY, null, undefined, {}]) {
      expect(isFiniteDecimalish(bad)).toBe(false);
      expect(() => asDecimalish(bad, 'ctx')).toThrow(KapomError);
    }
  });
});

describe('computeAggregate — sum/avg/count/min/max ผ่าน NumericStrategy', () => {
  const values = ['10.50', 2, '0.25', 7];

  it('sum / avg', () => {
    expect(nativeNumeric.toNumber(computeAggregate('sum', values, nativeNumeric))).toBeCloseTo(19.75, 10);
    expect(nativeNumeric.toNumber(computeAggregate('avg', values, nativeNumeric))).toBeCloseTo(4.9375, 10);
  });

  it('count = จำนวน element ไม่แตะค่าเลย (นับ column ข้อความได้)', () => {
    expect(computeAggregate('count', values, nativeNumeric)).toBe(4);
    expect(computeAggregate('count', ['Widget A', 'Widget B'], nativeNumeric)).toBe(2);
  });

  it('min / max เทียบเชิงตัวเลข ไม่ใช่ string compare — และคืนค่าต้นฉบับ (คง type เดิม)', () => {
    expect(computeAggregate('min', values, nativeNumeric)).toBe('0.25');
    expect(computeAggregate('max', values, nativeNumeric)).toBe('10.50');
    // string compare จะได้ '10.50' เป็น min เพราะ '1' < '2'
    expect(computeAggregate('min', ['10.50', '2'], nativeNumeric)).toBe('2');
  });

  it('array ว่าง: count/sum = 0, avg ไม่หารศูนย์, min/max ไม่ throw', () => {
    expect(computeAggregate('count', [], nativeNumeric)).toBe(0);
    expect(computeAggregate('sum', [], nativeNumeric)).toBe(0);
    expect(computeAggregate('avg', [], nativeNumeric)).toBe(0);
    expect(computeAggregate('min', [], nativeNumeric)).toBe(0);
    expect(computeAggregate('max', [], nativeNumeric)).toBe(0);
  });
});
