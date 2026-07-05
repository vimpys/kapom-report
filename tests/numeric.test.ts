import { describe, expect, it } from 'vitest';
import { nativeNumeric } from '../src/numeric/numeric-strategy';

describe('nativeNumeric — Decimalish boundary', () => {
  it('รับ number ตรงๆ', () => {
    expect(nativeNumeric.add(1.5, 2.5)).toBe(4);
    expect(nativeNumeric.subtract(10, 4)).toBe(6);
    expect(nativeNumeric.multiply(3, 2.5)).toBe(7.5);
    expect(nativeNumeric.divide(10, 4)).toBe(2.5);
  });

  it('รับ string จาก DB DECIMAL (mysql2/pg คืน string)', () => {
    expect(nativeNumeric.add('10.50', '2.25')).toBe(12.75);
    expect(nativeNumeric.multiply('3', 2)).toBe(6);
  });

  it('sum รวม number/string ปนกันได้', () => {
    expect(nativeNumeric.sum([1, '2.5', 3, '0.5'])).toBe(7);
    expect(nativeNumeric.sum([])).toBe(0);
  });

  it('toNumber แปลงที่จุดสุดท้ายก่อนส่ง jsPDF/Intl', () => {
    expect(nativeNumeric.toNumber('123.45')).toBe(123.45);
    expect(nativeNumeric.toNumber(9)).toBe(9);
  });
});
