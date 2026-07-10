import { describe, expect, it } from 'vitest';
import { BoxBlock, DEFAULT_BOX_PADDING } from '../../src/blocks/box-block';
import { createBlock } from '../../src/blocks/create-block';
import { DEFAULT_TEXT_STYLE, TextBlock } from '../../src/blocks/text-block';
import { KapomError, KapomLayoutError } from '../../src/core/errors';
import { RenderEngine } from '../../src/core/engine';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

const LINE_HEIGHT = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
const PAD = DEFAULT_BOX_PADDING;
// stub A4 margins 15 → content area y 15..282
const CONTENT_TOP = 15;
const CONTENT_BOTTOM = 282;

function textBoxBlock(count: number, options: Partial<Parameters<typeof boxOptions>[0]> = {}) {
  const children = Array.from({ length: count }, () => new TextBlock({ type: 'text', content: 'x' }));
  return new BoxBlock(children, boxOptions(options));
}

function boxOptions(
  overrides: Partial<{
    background: readonly [number, number, number];
    borderColor: readonly [number, number, number];
    borderWidth: number;
    padding: number;
    keepTogether: boolean;
  }> = {},
) {
  return {
    background: overrides.background,
    borderColor: overrides.borderColor,
    borderWidth: overrides.borderWidth ?? 0.2,
    padding: overrides.padding ?? PAD,
    keepTogether: overrides.keepTogether ?? false,
  };
}

describe('BoxBlock — validation (ผ่าน registry factory)', () => {
  it('children ว่าง → throw KapomError', () => {
    expect(() => createBlock({ type: 'box', children: [] })).toThrow(KapomError);
  });

  it('padding ติดลบ → throw KapomLayoutError', () => {
    expect(() => createBlock({ type: 'box', padding: -1, children: ['x'] })).toThrow(
      KapomLayoutError,
    );
  });

  it('borderWidth <= 0 → throw KapomLayoutError', () => {
    expect(() => createBlock({ type: 'box', borderWidth: 0, children: ['x'] })).toThrow(
      KapomLayoutError,
    );
  });

  it('table ใน box → throw KapomError (block ที่ paginate เองใช้ใน confined box ไม่ได้)', () => {
    expect(() =>
      createBlock({ type: 'box', children: [{ type: 'table', columns: [], data: [] }] }),
    ).toThrow(KapomError);
  });

  it('table ซ่อนใน stack ใน box → ยัง throw (เช็ค recursive)', () => {
    expect(() =>
      createBlock({
        type: 'box',
        children: [{ type: 'stack', children: [{ type: 'table', columns: [], data: [] }] }],
      }),
    ).toThrow(KapomError);
  });
});

describe('BoxBlock — measureHeight', () => {
  it('สูง = ผลรวมลูก + padding บน+ล่าง', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);

    const height = textBoxBlock(2).measureHeight(engine.createMeasureContext());

    expect(height).toBeCloseTo(2 * LINE_HEIGHT + 2 * PAD, 6);
  });
});

describe('BoxBlock — render (หน้าเดียวพอ)', () => {
  it('วาดพื้นก่อนเนื้อหา: rect เต็ม contentWidth แล้ววาดลูก inset ด้วย padding', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = textBoxBlock(1, { background: [205, 231, 208] });

    block.render(engine.createRenderContext());

    expect(stub.setFillColor).toHaveBeenCalledWith(205, 231, 208);
    expect(stub.rect).toHaveBeenCalledWith(15, 15, 180, LINE_HEIGHT + 2 * PAD, 'F');
    // ลูกวาดหลัง rect (พื้นอยู่หลังเนื้อหา) ที่ x/baseline inset ด้วย padding
    const rectOrder = stub.rect.mock.invocationCallOrder[0] ?? 0;
    const textOrder = stub.text.mock.invocationCallOrder[0] ?? 0;
    expect(rectOrder).toBeLessThan(textOrder);
    expect(stub.text).toHaveBeenCalledWith(['line1'], 15 + PAD, 15 + PAD + LINE_HEIGHT);
  });

  it('border: setDrawColor + setLineWidth + rect แบบ stroke', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = textBoxBlock(1, { borderColor: [178, 214, 186], borderWidth: 0.5 });

    block.render(engine.createRenderContext());

    expect(stub.setDrawColor).toHaveBeenCalledWith(178, 214, 186);
    expect(stub.setLineWidth).toHaveBeenCalledWith(0.5);
    expect(stub.rect).toHaveBeenCalledWith(15, 15, 180, LINE_HEIGHT + 2 * PAD, 'S');
  });

  it('advance cursor เท่าความสูงกล่องรวม padding', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    textBoxBlock(2).render(ctx);

    expect(ctx.cursor.y).toBeCloseTo(15 + 2 * LINE_HEIGHT + 2 * PAD, 6);
  });
});

describe('BoxBlock — page break (clone mode)', () => {
  it('พื้นที่พอแค่ลูกแรก → segment 1 ปิดกล่องท้ายหน้า, ลูกที่เหลือเปิดกล่องใหม่หน้าถัดไป', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    // เหลือพื้นที่ = padding×2 + 1.5 บรรทัด → ลูกแรกลง ลูกที่สองไม่ลง
    ctx.advanceY(CONTENT_BOTTOM - CONTENT_TOP - (2 * PAD + 1.5 * LINE_HEIGHT));
    const segment1Top = ctx.cursor.y;

    textBoxBlock(2, { background: [200, 200, 200] }).render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    // segment 1: กล่องปิดครบ (padding บน+ล่างของตัวเอง) ที่ท้ายหน้า 1
    expect(stub.rect).toHaveBeenNthCalledWith(1, 15, segment1Top, 180, LINE_HEIGHT + 2 * PAD, 'F');
    // segment 2: กล่องใหม่หัวหน้า 2
    expect(stub.rect).toHaveBeenNthCalledWith(2, 15, 15, 180, LINE_HEIGHT + 2 * PAD, 'F');
    expect(ctx.cursor.y).toBeCloseTo(15 + LINE_HEIGHT + 2 * PAD, 6);
  });

  it('พื้นที่เหลือไม่พอแม้ลูกแรก → ยกทั้งกล่องไปหน้าใหม่ (กล่องลูกเดียว = keep-together อัตโนมัติ)', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    ctx.advanceY(CONTENT_BOTTOM - CONTENT_TOP - (2 * PAD + 0.5 * LINE_HEIGHT)); // ไม่พอสักบรรทัด

    textBoxBlock(1, { background: [200, 200, 200] }).render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    expect(stub.rect).toHaveBeenCalledTimes(1);
    expect(stub.rect).toHaveBeenCalledWith(15, 15, 180, LINE_HEIGHT + 2 * PAD, 'F');
  });

  it('ลูกตัวเดียวสูงเกินหน้าเต็ม → throw KapomLayoutError (ทั้งโหมด breakable)', () => {
    // 70 บรรทัด ≈ 284mm > ความจุหน้าเต็ม (267 - padding)
    const { doc } = makeStubDoc(Array.from({ length: 70 }, (_, i) => `line${i}`));
    const engine = new RenderEngine(doc);

    expect(() => textBoxBlock(1).render(engine.createRenderContext())).toThrow(KapomLayoutError);
  });

  it('keepTogether: รวมทุกลูกเกินหน้าเต็ม → throw (แต่ละลูกไม่เกินหน้า)', () => {
    // ลูกละ 35 บรรทัด ≈ 142mm — สองลูกรวม 284 > 263
    const { doc } = makeStubDoc(Array.from({ length: 35 }, (_, i) => `line${i}`));
    const engine = new RenderEngine(doc);

    expect(() =>
      textBoxBlock(2, { keepTogether: true }).render(engine.createRenderContext()),
    ).toThrow(KapomLayoutError);
  });

  it('keepTogether: พื้นที่หน้านี้ไม่พอแต่รวมไม่เกินหน้า → ยกทั้งกล่องไปหน้าใหม่ ไม่ผ่า', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    ctx.advanceY(CONTENT_BOTTOM - CONTENT_TOP - (2 * PAD + 1.5 * LINE_HEIGHT)); // พอแค่ลูกเดียว

    textBoxBlock(2, { keepTogether: true, background: [200, 200, 200] }).render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    expect(stub.rect).toHaveBeenCalledTimes(1); // กล่องเดียว ไม่แตก segment
    expect(stub.rect).toHaveBeenCalledWith(15, 15, 180, 2 * LINE_HEIGHT + 2 * PAD, 'F');
  });
});

describe('RowBlock — overflow guard (แก้พร้อม box)', () => {
  it('row สูงเกินหน้าเต็ม → throw KapomLayoutError แทนวาดล้นเงียบ', () => {
    const { doc } = makeStubDoc(Array.from({ length: 70 }, (_, i) => `line${i}`));
    const engine = new RenderEngine(doc);
    const block = createBlock({ type: 'row', columns: [{ children: ['tall'] }] });

    expect(() => block.render(engine.createRenderContext())).toThrow(KapomLayoutError);
  });
});
