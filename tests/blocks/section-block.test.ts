import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { SectionBlock } from '../../src/blocks/section-block';
import { SpacerBlock } from '../../src/blocks/spacer-block';
import { makeStubDoc } from '../helpers/stub-doc';

describe('SectionBlock', () => {
  it('เก็บ name ไว้ได้ และ render/measure ทำงานเหมือน StackBlock', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new SectionBlock('summary', [
      new SpacerBlock({ type: 'spacer', height: 5 }),
      new SpacerBlock({ type: 'spacer', height: 7 }),
    ]);

    expect(block.name).toBe('summary');
    expect(block.measureHeight(engine.createMeasureContext())).toBe(12);

    const ctx = engine.createRenderContext();
    const startY = ctx.cursor.y;
    block.render(ctx);
    expect(ctx.cursor.y).toBeCloseTo(startY + 12, 6);
  });

  it('breakBefore: true บังคับขึ้นหน้าใหม่ก่อน render แม้พื้นที่ยังพอ', () => {
    const { doc, stub } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    // เลื่อน cursor ออกจากหัวหน้าก่อน กัน forcePageBreak เป็น no-op
    ctx.advanceY(20);

    const block = new SectionBlock(
      'next-section',
      [new SpacerBlock({ type: 'spacer', height: 5 })],
      true,
    );
    block.render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    expect(ctx.cursor.pageIndex).toBe(1);
  });

  it('breakBefore: true เป็น no-op ถ้า cursor อยู่หัวหน้าอยู่แล้ว', () => {
    const { doc, stub } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    const block = new SectionBlock(
      'first-section',
      [new SpacerBlock({ type: 'spacer', height: 5 })],
      true,
    );
    block.render(ctx);

    expect(stub.addPage).not.toHaveBeenCalled();
    expect(ctx.cursor.pageIndex).toBe(0);
  });

  it('breakBefore: false (default) ไม่ขึ้นหน้าใหม่', () => {
    const { doc, stub } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    ctx.advanceY(20);

    const block = new SectionBlock('no-break', [new SpacerBlock({ type: 'spacer', height: 5 })]);
    block.render(ctx);

    expect(stub.addPage).not.toHaveBeenCalled();
  });
});
