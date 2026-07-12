import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import {
  DividerBlock,
  DEFAULT_DIVIDER_THICKNESS,
  DEFAULT_DIVIDER_COLOR,
} from '../../src/blocks/divider-block';
import { KapomLayoutError } from '../../src/core/errors';
import { divider } from '../../src/types/node';
import { makeStubDoc } from '../helpers/stub-doc';

describe('DividerBlock', () => {
  it('measureHeight คืน default thickness เมื่อไม่ระบุ', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new DividerBlock({ type: 'divider' });

    expect(block.measureHeight(engine.createMeasureContext())).toBe(
      DEFAULT_DIVIDER_THICKNESS,
    );
  });

  it('render วาดเส้นเต็มความกว้าง content ที่กึ่งกลาง thickness แล้ว advance y', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new DividerBlock({ type: 'divider' });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(stub.setDrawColor).toHaveBeenCalledWith(...DEFAULT_DIVIDER_COLOR);
    expect(stub.setLineWidth).toHaveBeenCalledWith(DEFAULT_DIVIDER_THICKNESS);
    expect(stub.line).toHaveBeenCalledWith(
      15,
      15 + DEFAULT_DIVIDER_THICKNESS / 2,
      15 + 180,
      15 + DEFAULT_DIVIDER_THICKNESS / 2,
    );
    expect(ctx.cursor.y).toBe(15 + DEFAULT_DIVIDER_THICKNESS);
  });

  it('รับ thickness/color override', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new DividerBlock({ type: 'divider', thickness: 2, color: [200, 0, 0] });

    block.render(engine.createRenderContext());

    expect(stub.setDrawColor).toHaveBeenCalledWith(200, 0, 0);
    expect(stub.setLineWidth).toHaveBeenCalledWith(2);
  });

  it('thickness <= 0 หรือ NaN → throw KapomLayoutError ตอนสร้าง', () => {
    expect(() => new DividerBlock({ type: 'divider', thickness: 0 })).toThrow(
      KapomLayoutError,
    );
    expect(() => new DividerBlock({ type: 'divider', thickness: -1 })).toThrow(
      KapomLayoutError,
    );
    expect(
      () => new DividerBlock({ type: 'divider', thickness: Number.NaN }),
    ).toThrow(KapomLayoutError);
  });
});

describe('divider() shorthand', () => {
  it('ไม่ส่ง options → zero-config node ล้วน', () => {
    expect(divider()).toEqual({ type: 'divider' });
  });

  it('ส่ง options → merge เข้า node', () => {
    expect(divider({ thickness: 1, color: [1, 2, 3] })).toEqual({
      type: 'divider',
      thickness: 1,
      color: [1, 2, 3],
    });
  });
});
