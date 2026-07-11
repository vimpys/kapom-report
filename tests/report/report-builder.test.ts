import { describe, expect, it } from 'vitest';
import { reportBuilder } from '../../src/report/report-builder';
import type { ReportNodeInput } from '../../src/types/node';

describe('reportBuilder — toConfig (pure assembly)', () => {
  it('content ต่อ block ตามลำดับที่เรียก', () => {
    const config = reportBuilder()
      .content('a')
      .content('b', 'c')
      .toConfig();

    expect(config.blocks).toEqual(['a', 'b', 'c']);
  });

  it('title อยู่หน้า content เสมอ (แม้เรียกทีหลัง); string → reportTitle text + spacer', () => {
    const config = reportBuilder().content('body').title('My Report').toConfig();

    expect(config.blocks).toEqual([
      { type: 'text', content: 'My Report', role: 'reportTitle' },
      { type: 'spacer', height: 6 },
      'body',
    ]);
  });

  it('title ที่เป็น node prepend ตรงๆ ไม่แปลง', () => {
    const logo: ReportNodeInput = { type: 'image', data: 'x', format: 'PNG', width: 10, height: 10 };
    const config = reportBuilder().title(logo).content('body').toConfig();

    expect(config.blocks[0]).toBe(logo);
  });

  it('summary ห่อ bottomAnchor อยู่ท้ายสุดเสมอ', () => {
    const config = reportBuilder()
      .content('body')
      .summary({ type: 'signature', slots: [{ label: 'Signed' }] })
      .toConfig();

    const last = config.blocks[config.blocks.length - 1];
    expect(last).toEqual({
      type: 'bottomAnchor',
      children: [{ type: 'signature', slots: [{ label: 'Signed' }] }],
    });
  });

  it('ไม่มี summary → ไม่มี bottomAnchor', () => {
    const config = reportBuilder().content('body').toConfig();
    expect(config.blocks).toEqual(['body']);
  });

  it('ลำดับสุดท้ายเสมอ: title → content → summary(bottomAnchor)', () => {
    const config = reportBuilder()
      .content('body')
      .summary('foot')
      .title('T')
      .toConfig();

    expect(config.blocks).toEqual([
      { type: 'text', content: 'T', role: 'reportTitle' },
      { type: 'spacer', height: 6 },
      'body',
      { type: 'bottomAnchor', children: ['foot'] },
    ]);
  });

  it('pageSetup แยก format/orientation → document, margins → margins', () => {
    const config = reportBuilder()
      .content('body')
      .pageSetup({ format: 'letter', orientation: 'landscape', margins: { top: 20, bottom: 20, left: 25, right: 25 } })
      .toConfig();

    expect(config.document).toEqual({ format: 'letter', orientation: 'landscape' });
    expect(config.margins).toEqual({ top: 20, bottom: 20, left: 25, right: 25 });
  });

  it('pageSetup ใส่แค่ margins → ไม่ตั้ง document (คงค่า default a4/portrait)', () => {
    const config = reportBuilder()
      .content('body')
      .pageSetup({ margins: { top: 10, bottom: 10, left: 10, right: 10 } })
      .toConfig();

    expect(config.margins).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
    expect(config.document).toBeUndefined();
  });

  it('page-frame + settings map เข้า config option ตรงๆ', () => {
    const builder = reportBuilder()
      .content('body')
      .pageNumber('bottom-center')
      .margins({ top: 20, bottom: 20, left: 20, right: 20 })
      .document({ orientation: 'landscape' });
    builder.pageHeader.addBlock('H').height(10);
    const config = builder.toConfig();

    expect(config.pageNumber).toBe('bottom-center');
    expect(config.pageHeader).toEqual({ height: 10, children: ['H'] });
    expect(config.margins).toEqual({ top: 20, bottom: 20, left: 20, right: 20 });
    expect(config.document).toEqual({ orientation: 'landscape' });
  });

  it('pageHeader sub-builder: addBlock ต่อเนื่อง, ไม่ตั้ง height → auto (config ไม่มี height)', () => {
    const builder = reportBuilder().content('body');
    builder.pageHeader.addBlock('A').addBlock('B');
    const config = builder.toConfig();

    expect(config.pageHeader).toEqual({ children: ['A', 'B'] }); // ไม่มี height = auto-measure ที่ engine
  });

  it('pageHeader ว่าง (ไม่ addBlock) → ไม่มี pageHeader ใน config', () => {
    const config = reportBuilder().content('body').toConfig();
    expect(config.pageHeader).toBeUndefined();
  });

  it('showOnFirstPage(false) map ลง band', () => {
    const builder = reportBuilder().content('body');
    builder.pageHeader.addBlock('H').showOnFirstPage(false);
    expect(builder.toConfig().pageHeader).toEqual({ children: ['H'], showOnFirstPage: false });
  });
});

describe('reportBuilder — build (เท่ากับ object form)', () => {
  it('build() คืน KapomReport ที่มี doc/save/preview', () => {
    const report = reportBuilder()
      .content({ type: 'text', content: 'hello' })
      .build();

    expect(report.doc).toBeDefined();
    expect(typeof report.save).toBe('function');
    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
