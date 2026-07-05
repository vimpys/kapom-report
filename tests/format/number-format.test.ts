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
