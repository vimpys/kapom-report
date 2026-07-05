import { describe, expect, it } from 'vitest';
import { DEFAULT_TYPOGRAPHY, resolveTypography } from '../../src/types/typography';

describe('resolveTypography', () => {
  it('ไม่มี override → คืน DEFAULT_TYPOGRAPHY ตรงๆ', () => {
    expect(resolveTypography()).toBe(DEFAULT_TYPOGRAPHY);
  });

  it('override เฉพาะบาง field ของ token เดียว — field อื่นใน token นั้นยังเป็น default', () => {
    const resolved = resolveTypography({ columnHeader: { fontSize: 14 } });

    expect(resolved.columnHeader).toEqual({
      ...DEFAULT_TYPOGRAPHY.columnHeader,
      fontSize: 14,
    });
  });

  it('token ที่ไม่ได้ override ยังเป็นค่า default เดิม', () => {
    const resolved = resolveTypography({ columnHeader: { fontSize: 14 } });

    expect(resolved.detailRow).toEqual(DEFAULT_TYPOGRAPHY.detailRow);
    expect(resolved.summary).toEqual(DEFAULT_TYPOGRAPHY.summary);
  });

  it('override หลาย token พร้อมกัน', () => {
    const resolved = resolveTypography({
      reportTitle: { fontSize: 24 },
      detailRow: { fontStyle: 'italic' },
    });

    expect(resolved.reportTitle.fontSize).toBe(24);
    expect(resolved.detailRow.fontStyle).toBe('italic');
    expect(resolved.detailRow.fontSize).toBe(DEFAULT_TYPOGRAPHY.detailRow.fontSize);
  });

  it('override color (RGB tuple) ทั้งก้อนแทนที่ ไม่ merge ทีละ element', () => {
    const resolved = resolveTypography({ columnHeader: { color: [10, 20, 30] } });

    expect(resolved.columnHeader.color).toEqual([10, 20, 30]);
  });
});
