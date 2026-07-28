import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import type { MeasurableBlock } from '../../src/core/context';
import type { PageBandContext } from '../../src/core/page-band';
import { makeStubDoc } from '../helpers/stub-doc';

/** block ปลอมสูงคงที่ */
function fixedBlock(height: number): MeasurableBlock {
  return {
    measureHeight: () => height,
    render: (ctx) => ctx.advanceY(height),
  };
}

describe('RenderEngine — page band reserved height', () => {
  it('มี pageHeader → content เริ่มใต้ header (contentTop หัก height)', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageHeader: { height: 20, render: () => {} },
    });
    const ctx = engine.createRenderContext();

    expect(ctx.contentTop).toBe(15 + 20);
    expect(ctx.cursor.y).toBe(35);
  });

  it('มี pageFooter → contentBottom เหนือ footer', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageFooter: { height: 12, render: () => {} },
    });
    const ctx = engine.createRenderContext();

    expect(ctx.contentBottom).toBe(297 - 15 - 12);
  });
});

describe('RenderEngine — finalize() draws bands per page', () => {
  it('ไม่มี band → finalize เป็น no-op (ไม่แตะ setPage)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(stub.setPage).not.toHaveBeenCalled();
  });

  it('วาด header+footer ทุกหน้า พร้อม pageIndex/pageCount ถูกต้อง', () => {
    const { doc } = makeStubDoc();
    const headerCalls: Array<{ pageIndex: number; pageCount: number; y: number }> = [];
    const footerCalls: Array<{ pageIndex: number; pageCount: number; y: number }> = [];
    const engine = new RenderEngine(doc, {
      pageHeader: {
        height: 20,
        render: (c: PageBandContext) =>
          headerCalls.push({ pageIndex: c.pageIndex, pageCount: c.pageCount, y: c.y }),
      },
      pageFooter: {
        height: 10,
        render: (c: PageBandContext) =>
          footerCalls.push({ pageIndex: c.pageIndex, pageCount: c.pageCount, y: c.y }),
      },
    });

    // 3 block สูงพอให้ล้นเป็น 2 หน้า (content area = 297-15-15-20-10 = 237)
    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    engine.finalize();

    expect(headerCalls).toEqual([
      { pageIndex: 0, pageCount: 2, y: 15 }, // header ที่ margin.top
      { pageIndex: 1, pageCount: 2, y: 15 },
    ]);
    // footer top = 297 - 15 - 10 = 272
    expect(footerCalls).toEqual([
      { pageIndex: 0, pageCount: 2, y: 272 },
      { pageIndex: 1, pageCount: 2, y: 272 },
    ]);
  });

  it('showOnFirstPage: false → ข้ามหน้าแรก วาดหน้า 2 เป็นต้นไป', () => {
    const { doc } = makeStubDoc();
    const pages: number[] = [];
    const engine = new RenderEngine(doc, {
      pageHeader: {
        height: 20,
        showOnFirstPage: false,
        render: (c: PageBandContext) => pages.push(c.pageIndex),
      },
    });

    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    engine.finalize();

    expect(pages).toEqual([1]); // เฉพาะหน้า 2 (index 1)
  });

  it('band context ได้ x/width ตาม margin', () => {
    const { doc } = makeStubDoc();
    let captured: PageBandContext | undefined;
    const engine = new RenderEngine(doc, {
      pageFooter: { height: 10, render: (c) => (captured = c) },
    });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(captured?.x).toBe(15);
    expect(captured?.width).toBe(210 - 15 - 15);
    expect(captured?.height).toBe(10);
  });

  it('finalize คืน active page เดิมหลังวาด band เสร็จ', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageFooter: { height: 10, render: () => {} },
    });

    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    const before = stub.getCurrentPageInfo().pageNumber;
    engine.finalize();

    expect(stub.getCurrentPageInfo().pageNumber).toBe(before);
  });

  it('band.drawText ส่งไป doc.text ผ่าน normalizer (strip zero-width)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      pageFooter: {
        height: 10,
        render: (c) => c.drawText(`a${String.fromCharCode(0x200b)}b`, c.x, c.y),
      },
    });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(stub.text).toHaveBeenCalledWith('ab', 15, 297 - 15 - 10);
  });
});
describe('RenderEngine — decoration ที่ไม่ได้ตั้ง ต้องไม่ถูกวาด', () => {
  /**
   * กันการ "ยุบ" เงื่อนไขสองข้อ (มีของไหม / หน้านี้วาดไหม) เข้าด้วยกัน — ดู drawsOnPage ใน engine.ts
   * เขียนแบบ optional chaining บน flag จะทำให้ decoration ที่ไม่ได้ตั้งเลย ถูกตีเป็น
   * "ไม่ได้ระบุ → ใช้ค่า default = วาด" แล้วพยายามวาดของที่ไม่มีอยู่บนหน้า 2 เป็นต้นไป
   */
  it('ตั้งแค่ footer: header ที่ไม่ได้ตั้งต้องไม่ถูกแตะ แม้บนหน้า 2+', () => {
    const { doc } = makeStubDoc();
    const footerPages: number[] = [];
    const engine = new RenderEngine(doc, {
      pageFooter: {
        height: 10,
        render: (ctx: PageBandContext) => footerPages.push(ctx.pageIndex),
      },
    });

    engine.render([fixedBlock(500), fixedBlock(500)]); // ยาวพอให้ขึ้นหน้าใหม่
    expect(() => engine.finalize()).not.toThrow();

    expect(footerPages.length).toBeGreaterThan(1); // มีหลายหน้าให้ทดสอบจริง
    expect(footerPages).toEqual([...footerPages.keys()]); // วาดทุกหน้าตั้งแต่ 0
  });

  it('ตั้งแค่ header: footer ที่ไม่ได้ตั้งต้องไม่ถูกแตะ', () => {
    const { doc } = makeStubDoc();
    const headerPages: number[] = [];
    const engine = new RenderEngine(doc, {
      pageHeader: {
        height: 10,
        render: (ctx: PageBandContext) => headerPages.push(ctx.pageIndex),
      },
    });

    engine.render([fixedBlock(500), fixedBlock(500)]);
    expect(() => engine.finalize()).not.toThrow();

    expect(headerPages.length).toBeGreaterThan(1);
  });
});
