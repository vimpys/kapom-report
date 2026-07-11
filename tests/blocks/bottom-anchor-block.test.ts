import { describe, expect, it } from 'vitest';
import { BottomAnchorBlock } from '../../src/blocks/bottom-anchor-block';
import { createBlock } from '../../src/blocks/create-block';
import { DEFAULT_TEXT_STYLE, TextBlock } from '../../src/blocks/text-block';
import { KapomError } from '../../src/core/errors';
import { RenderEngine } from '../../src/core/engine';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

const LINE_HEIGHT = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
// stub A4 content area: y 15..282 (margins 15)
const CONTENT_BOTTOM = 282;

describe('BottomAnchorBlock', () => {
  it('measureHeight = ผลรวมความสูงลูก (ไม่รวม gap)', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new BottomAnchorBlock([
      new TextBlock({ type: 'text', content: 'a' }),
      new TextBlock({ type: 'text', content: 'b' }),
    ]);

    expect(block.measureHeight(engine.createMeasureContext())).toBeCloseTo(2 * LINE_HEIGHT, 6);
  });

  it('ดันลูกไปชิดล่างของหน้า: จบที่ contentBottom พอดี', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    const block = new BottomAnchorBlock([new TextBlock({ type: 'text', content: 'sig' })]);

    block.render(ctx);

    // cursor เริ่มที่ 15, ลูกสูง 1 บรรทัด → ควรถูกดันให้จบพอดีที่ contentBottom 282
    expect(ctx.cursor.y).toBeCloseTo(CONTENT_BOTTOM, 6);
  });

  it('วาดลูกที่ baseline ใกล้ contentBottom (ไม่ใช่หัวหน้า)', () => {
    const { stub, doc } = makeStubDoc(['sig']);
    const engine = new RenderEngine(doc);
    const block = new BottomAnchorBlock([new TextBlock({ type: 'text', content: 'sig' })]);

    block.render(engine.createRenderContext());

    // TextBlock วาด baseline = boxTop + lineHeight; boxTop = 282 - lineHeight → baseline = 282
    const call = stub.text.mock.calls.find((c) => c[0] === 'sig' || (Array.isArray(c[0]) && c[0].includes('sig')));
    expect(call?.[2] as number).toBeCloseTo(CONTENT_BOTTOM, 4);
  });

  it('เนื้อหาอยู่ใกล้ล่างจนไม่พอ (gap ≤ 0) → ไม่ดันย้อน, ลูก break ไปหน้าใหม่ (ไม่ทับ/ไม่ throw)', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    ctx.advanceY(CONTENT_BOTTOM - 15 - LINE_HEIGHT * 0.5); // เหลือครึ่งบรรทัด — ลูก 1 บรรทัดไม่พอ
    const block = new BottomAnchorBlock([new TextBlock({ type: 'text', content: 'sig' })]);

    expect(() => block.render(ctx)).not.toThrow(); // ไม่ push ย้อน (advanceY ติดลบจะ throw)
    expect(stub.addPage).toHaveBeenCalledTimes(1); // ลูกที่ไม่พอ break ไปหน้าใหม่
  });

  it('ผ่าน registry + engine เต็มวง — signature ถูกดันไปล่างสุด', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = createBlock({
      type: 'bottomAnchor',
      children: [{ type: 'signature', slots: [{ label: 'Signed' }] }],
    });

    expect(() => engine.render([block])).not.toThrow();
  });

  it('bottomAnchor ใน row column → throw KapomError (pin ล่างไม่มีความหมายในโซนคงที่)', () => {
    expect(() =>
      createBlock({
        type: 'row',
        columns: [{ children: [{ type: 'bottomAnchor', children: ['x'] }] }],
      }),
    ).toThrow(KapomError);
  });

  it('bottomAnchor ใน box → throw KapomError', () => {
    expect(() =>
      createBlock({ type: 'box', children: [{ type: 'bottomAnchor', children: ['x'] }] }),
    ).toThrow(KapomError);
  });
});
