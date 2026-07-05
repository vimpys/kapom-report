import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { StackBlock } from '../../src/blocks/stack-block';
import { SpacerBlock } from '../../src/blocks/spacer-block';
import { makeStubDoc } from '../helpers/stub-doc';

describe('StackBlock — measureHeight', () => {
  it('รวมความสูงลูกทุกตัว (recursive-friendly — ลูกเป็น stack ซ้อนได้)', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new StackBlock([
      new SpacerBlock({ type: 'spacer', height: 5 }),
      new SpacerBlock({ type: 'spacer', height: 7 }),
    ]);

    expect(block.measureHeight(engine.createMeasureContext())).toBe(12);
  });
});

describe('StackBlock — render', () => {
  it('render ลูกตามลำดับ แล้ว advance cursor ตามผลรวม', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new StackBlock([
      new SpacerBlock({ type: 'spacer', height: 5 }),
      new SpacerBlock({ type: 'spacer', height: 7 }),
    ]);
    const ctx = engine.createRenderContext();
    const startY = ctx.cursor.y;

    block.render(ctx);

    expect(ctx.cursor.y).toBeCloseTo(startY + 12, 6);
  });

  it('ลูกที่เกินพื้นที่เหลือ break หน้าใหม่กลาง stack เอง (per-child ensureSpace)', () => {
    const { stub, doc } = makeStubDoc();
    // contentTop=15, contentBottom=297-277=20 → เหลือ content area แค่ 5mm
    const engine = new RenderEngine(doc, { margins: { top: 15, bottom: 277 } });
    const block = new StackBlock([
      new SpacerBlock({ type: 'spacer', height: 4 }),
      new SpacerBlock({ type: 'spacer', height: 4 }),
    ]);
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    expect(ctx.cursor.pageIndex).toBe(1);
  });
});
