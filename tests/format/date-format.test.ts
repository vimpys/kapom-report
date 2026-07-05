import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime } from '../../src/format/date-format';

const SAMPLE = new Date(Date.UTC(2026, 6, 5, 14, 30, 0));

describe('date-format', () => {
  it('formatDate ใช้ default locale en-CA → YYYY-MM-DD ไม่กำกวม', () => {
    expect(formatDate(SAMPLE)).toBe('2026-07-05');
  });

  it('formatDate รับ locale/dateStyle override', () => {
    expect(formatDate(SAMPLE, { locale: 'en-US', dateStyle: 'long' })).toBe('July 5, 2026');
  });

  it('formatDate รองรับ th-TH Buddhist calendar ผ่าน locale override', () => {
    const result = formatDate(SAMPLE, { locale: 'th-TH-u-ca-buddhist', dateStyle: 'long' });
    expect(result).toContain('2569');
  });

  it('formatTime ใช้ default locale en-CA พร้อม timeStyle short', () => {
    const result = formatTime(SAMPLE);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formatTime รับ timeStyle override', () => {
    const result = formatTime(SAMPLE, { locale: 'en-US', timeStyle: 'short' });
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });

  it('formatDateTime รวม date+time', () => {
    const result = formatDateTime(SAMPLE, { locale: 'en-US', dateStyle: 'short', timeStyle: 'short' });
    expect(result).toContain('7/5/26');
  });

  it('formatter cache ไม่ throw เมื่อเรียกซ้ำด้วย options เดิม', () => {
    expect(() => {
      formatDate(SAMPLE);
      formatDate(SAMPLE);
    }).not.toThrow();
  });
});
