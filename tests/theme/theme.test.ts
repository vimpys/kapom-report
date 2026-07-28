import { describe, expect, it } from 'vitest';
import { KapomError } from '../../src/core/errors';
import type { RGB } from '../../src/types/primitives';
import {
  DEFAULT_RESOLVED_THEME,
  resolveTheme,
  THEME_PRESETS,
} from '../../src/theme/theme';

describe('resolveTheme', () => {
  it('ไม่ส่ง input → DEFAULT_RESOLVED_THEME (โทนเดิม backward compatible)', () => {
    expect(resolveTheme()).toBe(DEFAULT_RESOLVED_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_RESOLVED_THEME);
    expect(DEFAULT_RESOLVED_THEME.primary).toEqual([41, 128, 185]);
    expect(DEFAULT_RESOLVED_THEME.bandFill).toEqual([236, 240, 241]);
    expect(DEFAULT_RESOLVED_THEME.zebraFill).toBeUndefined();
  });

  it('preset name → resolve จาก THEME_PRESETS', () => {
    const green = resolveTheme('green');
    expect(green.primary).toEqual(THEME_PRESETS.green.primary);
    expect(green.zebraFill).toEqual(THEME_PRESETS.green.zebraFill);
  });

  it('auto-contrast: primary เข้ม → onPrimary ขาว, bandFill อ่อน → onBand ดำ', () => {
    const green = resolveTheme('green'); // primary [47,93,63] เข้ม, bandFill [214,232,218] อ่อน
    expect(green.onPrimary).toEqual([255, 255, 255]);
    expect(green.onBand).toEqual([0, 0, 0]);
  });

  it('custom object: ระบุ on* เองได้ (ชนะ auto-contrast)', () => {
    const t = resolveTheme({ primary: [10, 10, 10], bandFill: [250, 250, 250], onPrimary: [200, 220, 255] });
    expect(t.onPrimary).toEqual([200, 220, 255]); // ระบุเอง
    expect(t.onBand).toEqual([0, 0, 0]); // auto (bandFill อ่อน)
  });

  it('nested tint derive จาก bandFill/onBand เมื่อเป็น preset', () => {
    const green = resolveTheme('green');
    expect(green.nestedIdentityFill).toEqual(green.bandFill);
    expect(green.nestedChildText).toEqual(green.onBand);
  });

  it('zebraFill: preset ที่ไม่ตั้ง → undefined (ไม่มี zebra)', () => {
    expect(resolveTheme('blue').zebraFill).toBeUndefined();
    expect(resolveTheme('graphite').zebraFill).toBeUndefined();
    expect(resolveTheme('stone').zebraFill).toBeUndefined();
  });

  it('pastel preset (rose/lavender/aqua/stone): primary อ่อน → onPrimary auto = ดำ', () => {
    for (const name of ['rose', 'lavender', 'aqua', 'stone'] as const) {
      expect(resolveTheme(name).onPrimary).toEqual([0, 0, 0]);
    }
  });

  it('ชื่อ preset ไม่รู้จัก → throw KapomError (fail-fast)', () => {
    // @ts-expect-error — จงใจส่งชื่อผิดเพื่อทดสอบ runtime guard
    expect(() => resolveTheme('teal')).toThrow(KapomError);
  });
});

describe('resolveTheme — validate + copy สีที่รับเข้ามา', () => {
  it('channel นอกช่วง 0–255 / ไม่ใช่เลข → throw KapomError พร้อมชื่อ field', () => {
    expect(() => resolveTheme({ primary: [300, 0, 0], bandFill: [0, 0, 0] })).toThrow(/theme\.primary/);
    expect(() => resolveTheme({ primary: [0, 0, 0], bandFill: [0, -1, 0] })).toThrow(/theme\.bandFill/);
    expect(() => resolveTheme({ primary: [0, 0, 0], bandFill: [0, Number.NaN, 0] })).toThrow(KapomError);
    expect(() =>
      resolveTheme({ primary: [0, 0, 0], bandFill: [0, 0, 0], zebraFill: [256, 0, 0] }),
    ).toThrow(/theme\.zebraFill/);
  });

  it('tuple ที่ความยาวไม่ใช่ 3 → throw', () => {
    expect(() => resolveTheme({ primary: [0, 0] as unknown as RGB, bandFill: [0, 0, 0] })).toThrow(
      /tuple of 3/,
    );
  });

  it('ขอบเขต 0 กับ 255 ใช้ได้', () => {
    expect(() => resolveTheme({ primary: [0, 0, 0], bandFill: [255, 255, 255] })).not.toThrow();
  });

  it('คัดลอกสี ไม่ถือ reference ของ caller — mutate ทีหลังต้องไม่กระทบ theme ที่ resolve แล้ว', () => {
    const primary: [number, number, number] = [10, 20, 30];
    const resolved = resolveTheme({ primary, bandFill: [200, 200, 200] });

    primary[0] = 999;

    expect(resolved.primary).toEqual([10, 20, 30]);
  });
});
