import { describe, expect, it } from 'vitest';
import { ReportRegistry } from '../../src/report/report-registry';
import { KapomError } from '../../src/core/errors';

interface ReportContext {
  hotelName: string;
}

describe('ReportRegistry', () => {
  it('build() ประกอบ section ตามลำดับชื่อ โดย inject shared context เดียวกันทุก builder', () => {
    const registry = new ReportRegistry<ReportContext>();
    registry.register('header', (ctx) => ({
      type: 'section',
      name: 'header',
      children: [{ type: 'text', content: ctx.hotelName }],
    }));
    registry.register('footer', (ctx) => ({
      type: 'section',
      name: 'footer',
      children: [{ type: 'text', content: `© ${ctx.hotelName}` }],
    }));

    const sections = registry.build(['header', 'footer'], { hotelName: 'Kapom Hotel' });

    expect(sections).toHaveLength(2);
    expect(sections[0]?.name).toBe('header');
    expect(sections[1]?.name).toBe('footer');
  });

  it('register() ชื่อซ้ำ throw KapomError ทันที', () => {
    const registry = new ReportRegistry<ReportContext>();
    registry.register('header', () => ({ type: 'section', name: 'header', children: [] }));

    expect(() =>
      registry.register('header', () => ({ type: 'section', name: 'header', children: [] })),
    ).toThrow(KapomError);
  });

  it('build() ชื่อที่ไม่เคย register throw KapomError ทันที', () => {
    const registry = new ReportRegistry<ReportContext>();
    registry.register('header', () => ({ type: 'section', name: 'header', children: [] }));

    expect(() => registry.build(['missing'], { hotelName: 'x' })).toThrow(KapomError);
  });

  it('build() รองรับ order ซ้ำ (section เดิมสร้างซ้ำได้ เช่น ใช้ซ้ำหลายจุดใน layout)', () => {
    const registry = new ReportRegistry<ReportContext>();
    registry.register('divider', () => ({ type: 'section', name: 'divider', children: [] }));

    const sections = registry.build(['divider', 'divider'], { hotelName: 'x' });

    expect(sections).toHaveLength(2);
  });
});
