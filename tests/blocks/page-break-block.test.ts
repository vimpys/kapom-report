import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { PageBreakBlock } from '../../src/blocks/page-break-block';
import { assertConfinedChildAllowed } from '../../src/blocks/row-block';
import { KapomError } from '../../src/core/errors';
import { pageBreak } from '../../src/types/node';
import { makeStubDoc } from '../helpers/stub-doc';

describe('PageBreakBlock', () => {
  it('measureHeight = 0 (ไม่กินพื้นที่)', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);

    expect(new PageBreakBlock().measureHeight(engine.createMeasureContext())).toBe(0);
  });

  it('render บังคับขึ้นหน้าใหม่เมื่อ cursor ไม่ได้อยู่หัวหน้า', () => {
    const { doc, stub } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    ctx.advanceY(20); // เลื่อนออกจากหัวหน้าก่อน

    new PageBreakBlock().render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    expect(ctx.cursor.pageIndex).toBe(1);
  });

  it('render เป็น no-op ถ้า cursor อยู่หัวหน้าอยู่แล้ว (ไม่เกิดหน้าเปล่า)', () => {
    const { doc, stub } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    new PageBreakBlock().render(ctx);

    expect(stub.addPage).not.toHaveBeenCalled();
    expect(ctx.cursor.pageIndex).toBe(0);
  });
});

describe('pageBreak() shorthand', () => {
  it('คืน PageBreakNode', () => {
    expect(pageBreak()).toEqual({ type: 'pageBreak' });
  });

  it('อยู่ใน confined zone (box/row) ไม่ได้ → throw ตอน build', () => {
    expect(() => assertConfinedChildAllowed({ type: 'pageBreak' }, 'box')).toThrow(KapomError);
  });
});
