import { describe, expect, it } from 'vitest';
import { resolveSystemFields } from '../../src/core/system-field';
import { KapomError } from '../../src/core/errors';

const NOW = new Date(Date.UTC(2026, 6, 5, 14, 30, 0));

describe('resolveSystemFields', () => {
  it('แทน {pageNumber}', () => {
    expect(resolveSystemFields('หน้า {pageNumber}', { pageNumber: 3, totalPages: 10, now: NOW })).toBe(
      'หน้า 3',
    );
  });

  it('แทน {totalPages}', () => {
    expect(
      resolveSystemFields('จาก {totalPages}', { pageNumber: 3, totalPages: 10, now: NOW }),
    ).toBe('จาก 10');
  });

  it('แทนหลาย token ในสตริงเดียว', () => {
    expect(
      resolveSystemFields('หน้า {pageNumber} จาก {totalPages}', {
        pageNumber: 1,
        totalPages: 5,
        now: NOW,
      }),
    ).toBe('หน้า 1 จาก 5');
  });

  it('แทน {date}', () => {
    expect(
      resolveSystemFields('{date}', { pageNumber: 1, totalPages: 1, now: NOW }),
    ).toBe('2026-07-05');
  });

  it('แทน {time} ด้วย dateFormat override', () => {
    const result = resolveSystemFields(
      '{time}',
      { pageNumber: 1, totalPages: 1, now: NOW },
      { locale: 'en-US', timeStyle: 'short' },
    );
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });

  it('แทน {dateTime}', () => {
    const result = resolveSystemFields(
      '{dateTime}',
      { pageNumber: 1, totalPages: 1, now: NOW },
      { locale: 'en-US', dateStyle: 'short', timeStyle: 'short' },
    );
    expect(result).toContain('7/5/26');
  });

  it('token ที่ไม่รู้จัก → throw KapomError', () => {
    expect(() =>
      resolveSystemFields('{unknownToken}', { pageNumber: 1, totalPages: 1, now: NOW }),
    ).toThrow(KapomError);
  });

  it('ไม่มี token เลย → คืน string เดิม', () => {
    expect(resolveSystemFields('plain text', { pageNumber: 1, totalPages: 1, now: NOW })).toBe(
      'plain text',
    );
  });
});
