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
      .pageSetup({ orientation: 'landscape', margins: { top: 20, bottom: 20, left: 20, right: 20 } });
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

describe('reportBuilder — table() single-table shorthand', () => {
  interface Sale {
    product: string;
    qty: number;
  }

  it('column shorthand {key,header} → normalize เป็น DataColumn type:data', () => {
    const config = reportBuilder<Sale>()
      .table({
        columns: [
          { key: 'product', header: 'Product' },
          { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
        ],
        data: [{ product: 'A', qty: 2 }],
      })
      .toConfig();

    expect(config.blocks).toEqual([
      {
        type: 'table',
        columns: [
          { type: 'data', key: 'product', header: 'Product' },
          { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
        ],
        data: [{ product: 'A', qty: 2 }],
      },
    ]);
  });

  it('group string shorthand → { by }', () => {
    const config = reportBuilder<Sale>()
      .table({ columns: [{ key: 'product', header: 'Product' }], data: [], group: 'product' })
      .toConfig();

    expect(config.blocks[0]).toMatchObject({ type: 'table', group: { by: 'product' } });
  });

  it('group array shorthand → subGroup chain เรียงนอก→ใน', () => {
    const config = reportBuilder<Sale>()
      .table({ columns: [{ key: 'product', header: 'Product' }], data: [], group: ['product', 'qty'] })
      .toConfig();

    expect(config.blocks[0]).toMatchObject({
      type: 'table',
      group: { by: 'product', subGroup: { by: 'qty' } },
    });
  });

  it('table() แทรกใน body ตามลำดับ call — title → content → table → content', () => {
    const config = reportBuilder<Sale>()
      .title('T')
      .content('intro')
      .table({ columns: [{ key: 'product', header: 'Product' }], data: [] })
      .content('note')
      .toConfig();

    expect(config.blocks).toEqual([
      { type: 'text', content: 'T', role: 'reportTitle' },
      { type: 'spacer', height: 6 },
      'intro',
      { type: 'table', columns: [{ type: 'data', key: 'product', header: 'Product' }], data: [] },
      'note',
    ]);
  });

  it('column group → resolve recursive, ลูกที่เป็น shorthand {key,header} ได้ type:data', () => {
    const config = reportBuilder<Sale>()
      .table({
        columns: [
          { key: 'product', header: 'Product' },
          {
            type: 'group',
            header: 'Metrics',
            columns: [
              { key: 'qty', header: 'Qty', align: 'right' }, // shorthand ใน group
              { type: 'computed', header: 'x2', compute: (row) => row.qty * 2 },
            ],
          },
        ],
        data: [],
      })
      .toConfig();

    expect(config.blocks[0]).toMatchObject({
      type: 'table',
      columns: [
        { type: 'data', key: 'product', header: 'Product' },
        {
          type: 'group',
          header: 'Metrics',
          columns: [
            { type: 'data', key: 'qty', header: 'Qty', align: 'right' },
            { type: 'computed', header: 'x2' },
          ],
        },
      ],
    });
  });

  it('master-detail: nested / nestedLayout / nestedIndentColumn ผ่านเข้า TableNode', () => {
    const child = { type: 'table', columns: [{ type: 'data', key: 'x', header: 'X' }], data: [] } as never;
    const nested = (): typeof child => child;

    const config = reportBuilder<Sale>()
      .table({
        columns: [{ key: 'product', header: 'Product' }],
        data: [],
        nested,
        nestedLayout: 'below',
        nestedIndentColumn: 1,
      })
      .toConfig();

    expect(config.blocks[0]).toMatchObject({
      type: 'table',
      nested,
      nestedLayout: 'below',
      nestedIndentColumn: 1,
    });
  });

  it('table() หลายครั้ง → หลายตารางเรียงตามลำดับ call (interleave กับ content ได้)', () => {
    const config = reportBuilder<Sale>()
      .table({ columns: [{ key: 'product', header: 'Product' }], data: [] })
      .content('note')
      .table({ columns: [{ key: 'qty', header: 'Qty' }], data: [] })
      .toConfig();

    expect(config.blocks).toEqual([
      { type: 'table', columns: [{ type: 'data', key: 'product', header: 'Product' }], data: [] },
      'note',
      { type: 'table', columns: [{ type: 'data', key: 'qty', header: 'Qty' }], data: [] },
    ]);
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
