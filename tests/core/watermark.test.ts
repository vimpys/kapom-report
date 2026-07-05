import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import type { MeasurableBlock } from '../../src/core/context';
import type { WatermarkContext } from '../../src/core/watermark';
import { makeStubDoc } from '../helpers/stub-doc';

/** block ปลอมสูงคงที่ */
function fixedBlock(height: number): MeasurableBlock {
  return {
    measureHeight: () => height,
    render: (ctx) => ctx.advanceY(height),
  };
}

describe('RenderEngine — watermark ไม่หัก content area', () => {
  it('มี watermark → contentTop/contentBottom ไม่เปลี่ยน (ต่าง pageHeader/pageFooter)', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      watermark: { render: () => {} },
    });
    const ctx = engine.createRenderContext();

    expect(ctx.contentTop).toBe(15);
    expect(ctx.contentBottom).toBe(297 - 15);
  });
});

describe('RenderEngine — finalize() วาด watermark ทุกหน้า', () => {
  it('ไม่มี watermark/band → finalize เป็น no-op', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(stub.setPage).not.toHaveBeenCalled();
  });

  it('วาด watermark ทุกหน้า พร้อม pageIndex/pageCount ถูกต้อง', () => {
    const { doc } = makeStubDoc();
    const calls: Array<{ pageIndex: number; pageCount: number }> = [];
    const engine = new RenderEngine(doc, {
      watermark: {
        render: (c: WatermarkContext) =>
          calls.push({ pageIndex: c.pageIndex, pageCount: c.pageCount }),
      },
    });

    // 3 block สูงพอให้ล้นเป็น 2 หน้า (content area = 297-15-15 = 267)
    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    engine.finalize();

    expect(calls).toEqual([
      { pageIndex: 0, pageCount: 2 },
      { pageIndex: 1, pageCount: 2 },
    ]);
  });

  it('showOnFirstPage: false → ข้ามหน้าแรก วาดหน้า 2 เป็นต้นไป', () => {
    const { doc } = makeStubDoc();
    const pages: number[] = [];
    const engine = new RenderEngine(doc, {
      watermark: {
        showOnFirstPage: false,
        render: (c) => pages.push(c.pageIndex),
      },
    });

    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    engine.finalize();

    expect(pages).toEqual([1]);
  });

  it('watermark วาดก่อน pageHeader/pageFooter เสมอ (ลำดับ z ให้ band ทับ)', () => {
    const { doc } = makeStubDoc();
    const order: string[] = [];
    const engine = new RenderEngine(doc, {
      watermark: { render: () => order.push('watermark') },
      pageHeader: { height: 20, render: () => order.push('header') },
      pageFooter: { height: 10, render: () => order.push('footer') },
    });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(order).toEqual(['watermark', 'header', 'footer']);
  });

  it('watermark context ได้ pageWidth/pageHeight เต็มหน้า (ไม่ใช่ content area)', () => {
    const { doc } = makeStubDoc();
    let captured: WatermarkContext | undefined;
    const engine = new RenderEngine(doc, {
      watermark: { render: (c) => (captured = c) },
    });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(captured?.pageWidth).toBe(210);
    expect(captured?.pageHeight).toBe(297);
  });

  it('watermark.drawText ส่งไป doc.text ผ่าน normalizer (strip zero-width)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      watermark: {
        render: (c) => c.drawText(`a${String.fromCharCode(0x200b)}b`, 50, 150),
      },
    });

    engine.render([fixedBlock(10)]);
    engine.finalize();

    expect(stub.text).toHaveBeenCalledWith('ab', 50, 150);
  });

  it('finalize คืน active page เดิมหลังวาด watermark เสร็จ', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc, {
      watermark: { render: () => {} },
    });

    engine.render([fixedBlock(150), fixedBlock(100), fixedBlock(100)]);
    const before = stub.getCurrentPageInfo().pageNumber;
    engine.finalize();

    expect(stub.getCurrentPageInfo().pageNumber).toBe(before);
  });
});
