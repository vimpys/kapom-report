import { describe, expect, it } from 'vitest';
import { formatNumber, getNumberFormatter } from '../../src/format/number-format';
import { nativeNumeric } from '../../src/numeric/numeric-strategy';

describe('formatNumber', () => {
  it('default: th-TH ทศนิยม 2 ตำแหน่ง + คั่นหลักพัน', () => {
    expect(formatNumber(1234.5, nativeNumeric)).toBe('1,234.50');
    expect(formatNumber(0, nativeNumeric)).toBe('0.00');
  });

  it('รับ string decimal จาก DB ได้ตรงๆ', () => {
    expect(formatNumber('9876.543', nativeNumeric)).toBe('9,876.54');
  });

  it('ซ่อน float artifact — 0.1+0.2 ของ native แสดงเป็น 0.30', () => {
    const sum = nativeNumeric.add('0.1', '0.2'); // 0.30000000000000004
    expect(formatNumber(sum, nativeNumeric)).toBe('0.30');
  });

  it('override จำนวนทศนิยม', () => {
    expect(
      formatNumber(1234.5678, nativeNumeric, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    ).toBe('1,235');
  });

  it('override locale', () => {
    expect(
      formatNumber(1234.5, nativeNumeric, { locale: 'de-DE' }),
    ).toBe('1.234,50');
  });

  it('fractionDigits shorthand — ตั้งค่าเดียว ได้ min/max เท่ากันทั้งคู่', () => {
    expect(formatNumber(1234.5, nativeNumeric, { fractionDigits: 4 })).toBe('1,234.5000');
    expect(formatNumber(1234.56789, nativeNumeric, { fractionDigits: 4 })).toBe('1,234.5679');
  });

  it('minimumFractionDigits/maximumFractionDigits เจาะจงไว้ ชนะ fractionDigits shorthand ทีละฝั่ง', () => {
    // minimumFractionDigits ตั้งเจาะจงไว้ที่ 1 (ชนะ fractionDigits), maximumFractionDigits fallback ไปที่ fractionDigits (4)
    // ค่านี้มีแค่ 1 ตำแหน่งจริง ผ่าน minimum ที่ 1 แล้วเลยไม่ต้อง pad ไปถึง max 4
    expect(
      formatNumber(1234.5, nativeNumeric, { fractionDigits: 4, minimumFractionDigits: 1 }),
    ).toBe('1,234.5');
  });
});

describe('getNumberFormatter — cache', () => {
  it('config เดียวกันได้ instance เดิม (cache ทำงาน)', () => {
    expect(getNumberFormatter()).toBe(getNumberFormatter());
    expect(getNumberFormatter({ locale: 'en-US' })).toBe(
      getNumberFormatter({ locale: 'en-US' }),
    );
  });

  it('config ต่างกันได้คนละ instance', () => {
    expect(getNumberFormatter()).not.toBe(getNumberFormatter({ maximumFractionDigits: 4 }));
  });
});

describe('formatNumber — เก็บกวาด float noise ก่อนแสดงผล', () => {
  it('3 × 1.115 ต้องแสดง 3.35 ตามที่คำนวณด้วยมือ (float ได้ 3.3449999999999998 → เดิมพิมพ์ 3.34)', () => {
    const amount = nativeNumeric.multiply(3, '1.115');

    expect(amount).toBe(3.3449999999999998); // ยืนยันว่า input เพี้ยนจริงตามที่ตั้งใจทดสอบ
    expect(formatNumber(amount, nativeNumeric, { locale: 'en-US', fractionDigits: 2 })).toBe('3.35');
  });

  it('artifact อื่นๆ ของ float ก็หายไปด้วย', () => {
    const f = (v: number) => formatNumber(v, nativeNumeric, { locale: 'en-US', fractionDigits: 2 });

    expect(f(nativeNumeric.add(0.1, 0.2) as number)).toBe('0.30');
    expect(f(nativeNumeric.multiply(0.07, 100) as number)).toBe('7.00');
    expect(f(nativeNumeric.sum(Array(10000).fill('0.1')) as number)).toBe('1,000.00');
  });

  it('ไม่แตะหลักจำนวนเต็มของยอดขนาดใหญ่ (เหตุผลที่ใช้ตำแหน่งทศนิยม ไม่ใช่หลักนัยสำคัญ)', () => {
    const f = (v: number) => formatNumber(v, nativeNumeric, { locale: 'en-US', fractionDigits: 2 });

    // ปัด 12 หลักนัยสำคัญจะได้ 12,345,678,901.20 กับ 123,456,789,012.00 — ผิดทั้งคู่
    expect(f(12345678901.23)).toBe('12,345,678,901.23');
    expect(f(123456789012.34)).toBe('123,456,789,012.34');
  });

  it('ปัดครึ่งตามปกติยังทำงานเหมือนเดิม ไม่ได้ถูกกลืนไปกับการเก็บกวาด', () => {
    const f = (v: number) => formatNumber(v, nativeNumeric, { locale: 'en-US', fractionDigits: 2 });

    expect(f(1.005)).toBe('1.01');
    expect(f(4.475)).toBe('4.48');
    expect(f(2.344)).toBe('2.34');
  });

  it('คนที่ขอความละเอียดสูง ไม่ถูกเก็บกวาดทับ (guard เลื่อนตาม maximumFractionDigits)', () => {
    expect(formatNumber(1.0000000001, nativeNumeric, { locale: 'en-US', fractionDigits: 10 })).toBe(
      '1.0000000001',
    );
  });

  it('ค่าที่ไม่ finite ไม่ทำให้ toFixed พัง', () => {
    expect(() => formatNumber(Number.NaN, nativeNumeric)).not.toThrow();
    expect(() => formatNumber(Number.POSITIVE_INFINITY, nativeNumeric)).not.toThrow();
  });
});
