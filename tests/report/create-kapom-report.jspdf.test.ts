import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createKapomReport } from '../../src/report/create-kapom-report';
import { openWithDefaultViewer } from '../../src/report/node-io';

// กัน .preview() เปิด PDF viewer จริงระหว่างรันเทสต์ — mock เฉพาะตัวเปิด viewer
// (writeFile/writeTempPdf ใช้ของจริง เพื่อยืนยันว่าไฟล์ถูกเขียนจริง)
vi.mock('../../src/report/node-io', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/report/node-io')>();
  return { ...actual, openWithDefaultViewer: vi.fn() };
});

interface Sale {
  product: string;
  qty: number;
  category: string;
}

const data: Sale[] = [
  { product: 'A', qty: 1, category: 'Food' },
  { product: 'B', qty: 2, category: 'Drink' },
  { product: 'C', qty: 3, category: 'Food' },
];

describe('createKapomReport × jsPDF จริง', () => {
  it('zero-config: columns+data เท่านั้น → สร้าง doc ได้ ไม่ throw', () => {
    const report = createKapomReport({
      // ไม่มี aggregate — ถ้ามี summary row จะได้ label default 'รวม' (ไทย) ซึ่งโดน
      // Thai font guard เพราะเทสต์นี้ไม่ลงทะเบียนฟอนต์ไทย (ดูเทสต์ guard แยกด้านล่าง)
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'qty', header: 'Qty', align: 'right' },
      ],
      data,
    });

    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('aggregate + summaryLabel default (ไทย) โดยไม่ลงทะเบียนฟอนต์ไทย → throw KapomFontError (กัน mojibake เงียบ)', () => {
    expect(() =>
      createKapomReport({
        // คอลัมน์แรกไม่มี aggregate ให้ label 'รวม' (default ไทย) ลง cell แรกจริง
        columns: [
          { key: 'product', header: 'Product' },
          { key: 'qty', header: 'Qty', aggregate: 'sum' },
        ],
        data,
      }),
    ).toThrow(/Thai text/);
  });

  it('aggregate + summaryLabel อังกฤษ → ผ่านได้โดยไม่ต้องลงทะเบียนฟอนต์', () => {
    const report = createKapomReport({
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      ],
      data,
      summaryLabel: 'Total',
    });

    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('title → render เป็น text block reportTitle เหนือตาราง (ไม่ throw, เพิ่มความสูงจริง)', () => {
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      title: 'Monthly Sales Report',
    });

    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('group shorthand (string key) → ตารางจัดกลุ่มจริงผ่าน AutoTable ไม่ throw', () => {
    const report = createKapomReport({
      // ไม่มี aggregate — group foot default label เป็นไทย ('รวม X') จะโดน Thai font guard
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'qty', header: 'Qty', align: 'right' },
      ],
      data,
      group: 'category',
    });

    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('.save() เขียนไฟล์ PDF จริงลง disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kapom-report-'));
    const file = join(dir, 'report.pdf');
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    report.save(file);

    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    expect(bytes.subarray(0, 4).toString('utf-8')).toBe('%PDF');

    rmSync(dir, { recursive: true, force: true });
  });

  it('report.doc เป็น raw jsPDF instance จริง (escape hatch)', () => {
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    expect(typeof report.doc.output).toBe('function');
  });

  it('document: { orientation: landscape, format: letter } → หน้าจริงกว้างกว่าสูง (letter landscape)', () => {
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      document: { orientation: 'landscape', format: 'letter' },
    });

    const { width, height } = report.doc.internal.pageSize;
    expect(width).toBeGreaterThan(height);
  });

  it('ไม่ระบุ document → default ของ jsPDF เอง (a4 portrait, สูงกว่ากว้าง)', () => {
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    const { width, height } = report.doc.internal.pageSize;
    expect(height).toBeGreaterThan(width);
  });

  it('blocks variant: ReportNode tree ตรงๆ (text/section/table/signature) render จบไม่ throw', () => {
    const report = createKapomReport<Sale>({
      blocks: [
        { type: 'text', content: 'Composite Report', role: 'reportTitle' },
        { type: 'spacer', height: 6 },
        {
          type: 'section',
          name: 'sales',
          children: [
            { type: 'text', content: 'Sales', role: 'sectionHeading' },
            {
              type: 'table',
              columns: [{ type: 'data', key: 'product', header: 'Product' }],
              data,
            },
          ],
        },
        // label อังกฤษ — เทสต์นี้ไม่ลงทะเบียนฟอนต์ไทย (Thai font guard)
        { type: 'signature', slots: [{ label: 'Prepared by' }, { label: 'Approved by' }] },
      ],
    });

    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('.preview() เขียน temp PDF จริง + สั่งเปิดด้วย viewer ของ OS แล้วคืน path', () => {
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    const file = report.preview();

    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).subarray(0, 4).toString('utf-8')).toBe('%PDF');
    expect(vi.mocked(openWithDefaultViewer)).toHaveBeenCalledWith(file);

    rmSync(file, { force: true });
  });

  it('.preview() ซ้ำสองรอบ → temp file คนละไฟล์ (timestamp กันชนกัน)', async () => {
    const report = createKapomReport({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    const first = report.preview();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = report.preview();

    expect(second).not.toBe(first);
    rmSync(first, { force: true });
    rmSync(second, { force: true });
  });

  it('blocks variant: text shorthand — string ตรงๆ / object ไม่ใส่ type ใช้ได้ทั้งใน blocks และ children', () => {
    const report = createKapomReport({
      blocks: [
        'plain string line', // string = text node
        { content: 'Title without type', role: 'reportTitle' }, // object ไม่ใส่ type = text node
        {
          type: 'section',
          name: 's',
          children: ['child shorthand line', { content: 'styled', style: { fontSize: 8 } }],
        },
      ],
    });

    expect(report.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('blocks variant: facade เรียก finalize() ให้เอง — pageFooter band ถูกวาดจริง', () => {
    let footerDrawnOnPages = 0;
    createKapomReport({
      blocks: [{ type: 'text', content: 'hello' }],
      pageFooter: {
        height: 10,
        render: () => {
          footerDrawnOnPages += 1;
        },
      },
    });

    expect(footerDrawnOnPages).toBe(1); // 1 หน้า → footer วาด 1 ครั้งตอน finalize
  });
});
