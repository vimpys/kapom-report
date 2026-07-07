import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import type { MeasurableBlock } from '../../src/core/context';
import {
  DEFAULT_PAGE_NUMBER_FORMAT,
  DEFAULT_PAGE_NUMBER_POSITION,
  resolvePageNumber,
} from '../../src/core/page-number';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

function fixedBlock(height: number): MeasurableBlock {
  return {
    measureHeight: () => height,
    render: (ctx) => ctx.advanceY(height),
  };
}

const lineHeight9 = (9 * 1.15) / SCALE_FACTOR;

describe('resolvePageNumber — normalize 3-layer input (Progressive Disclosure)', () => {
  it('undefined/false → disabled', () => {
    expect(resolvePageNumber(undefined)).toBeUndefined();
    expect(resolvePageNumber(false)).toBeUndefined();
  });

  it('true (layer 1) → default position/format/showOnFirstPage', () => {
    const resolved = resolvePageNumber(true);
    expect(resolved).toEqual({
      position: DEFAULT_PAGE_NUMBER_POSITION,
      format: DEFAULT_PAGE_NUMBER_FORMAT,
      style: { fontSize: 9, fontStyle: 'normal', color: [0, 0, 0] },
      dateFormat: undefined,
      showOnFirstPage: true,
    });
  });

  it('string shorthand (layer 2) → position ตรงตามที่ส่ง, ที่เหลือ default', () => {
    const resolved = resolvePageNumber('bottom-right');
    expect(resolved?.position).toBe('bottom-right');
    expect(resolved?.format).toBe(DEFAULT_PAGE_NUMBER_FORMAT);
  });

  it('full object (layer 3) → override ได้ทุกฟิลด์ รวม style merge กับ default', () => {
    const resolved = resolvePageNumber({
      position: 'top-center',
      format: 'Page {pageNumber}',
      style: { fontSize: 12 },
      showOnFirstPage: false,
    });
    expect(resolved).toEqual({
      position: 'top-center',
      format: 'Page {pageNumber}',
      style: { fontSize: 12, fontStyle: 'normal', color: [0, 0, 0] },
      dateFormat: undefined,
      showOnFirstPage: false,
    });
  });
});

describe('RenderEngine — pageNumber ไม่หัก content area (ต่าง pageHeader/pageFooter)', () => {
  it('contentTop/contentBottom เท่ากับตอนไม่ตั้งอะไรเลย', () => {
    const withPageNumber = new RenderEngine(makeStubDoc().doc, { pageNumber: true }).createRenderContext();
    const withoutAnything = new RenderEngine(makeStubDoc().doc, {}).createRenderContext();

    expect(withPageNumber.contentTop).toBe(withoutAnything.contentTop);
    expect(withPageNumber.contentBottom).toBe(withoutAnything.contentBottom);
  });
});

describe('RenderEngine — finalize() วาด pageNumber ในระยะ margin', () => {
  it('default (bottom-left) → x = margins.left, y = กึ่งกลางแถบ margin ล่าง', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, { pageNumber: true });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    const expectedY = 297 - 15 + 15 / 2 + lineHeight9 / 2;
    expect(stub.text).toHaveBeenCalledWith('1 / 1', 15, expectedY);
  });

  it('bottom-right → x ชิดขวาในระยะ margin (ไม่ใช่ชิดขอบกระดาษ)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, { pageNumber: 'bottom-right' });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    const textWidth = '1 / 1'.length * 2; // stub getTextWidth: 2 หน่วยต่อตัวอักษร
    const expectedX = 15 + (210 - 15 - 15) - textWidth;
    expect(stub.text).toHaveBeenCalledWith('1 / 1', expectedX, expect.any(Number));
  });

  it('top-center → x กึ่งกลาง, y อยู่แถบ margin บน (ไม่ใช่ล่าง)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, { pageNumber: 'top-center' });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    const textWidth = '1 / 1'.length * 2;
    const expectedX = 15 + (210 - 15 - 15 - textWidth) / 2;
    const expectedY = 15 / 2 + lineHeight9 / 2;
    expect(stub.text).toHaveBeenCalledWith('1 / 1', expectedX, expectedY);
  });

  it('format ใส่ข้อความของ user เองรอบ token ได้', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageNumber: { format: 'Page {pageNumber} of {totalPages}' },
    });

    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    engine.finalize();

    expect(stub.text).toHaveBeenCalledWith('Page 1 of 2', expect.any(Number), expect.any(Number));
    expect(stub.text).toHaveBeenCalledWith('Page 2 of 2', expect.any(Number), expect.any(Number));
  });

  it('showOnFirstPage: false → ข้ามหน้าแรก วาดหน้า 2 เป็นต้นไป', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageNumber: { showOnFirstPage: false },
    });

    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    engine.finalize();

    expect(stub.text).not.toHaveBeenCalledWith('1 / 2', expect.any(Number), expect.any(Number));
    expect(stub.text).toHaveBeenCalledWith('2 / 2', expect.any(Number), expect.any(Number));
  });

  it('ใช้ร่วมกับ pageHeader/pageFooter พร้อมกันได้ (คนละกลไก ไม่ชนกัน)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageHeader: { height: 20, render: () => {} },
      pageFooter: { height: 10, render: () => {} },
      pageNumber: 'bottom-right',
    });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(stub.text).toHaveBeenCalledWith('1 / 1', expect.any(Number), expect.any(Number));
  });

  it('ไม่ตั้ง pageNumber เลย → finalize ไม่แตะ setPage (no-op เหมือนไม่มี band)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(stub.setPage).not.toHaveBeenCalled();
  });
});
