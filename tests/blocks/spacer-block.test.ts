import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { SpacerBlock } from '../../src/blocks/spacer-block';
import { KapomLayoutError } from '../../src/core/errors';
import { spacer } from '../../src/types/node';
import { DEFAULT_SPACER_HEIGHT } from '../../src/blocks/spacer-block';
import { makeStubDoc } from '../helpers/stub-doc';

describe('SpacerBlock', () => {
  it('measureHeight คืนค่า height ของ node ตรงๆ', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new SpacerBlock({ type: 'spacer', height: 12 });

    expect(block.measureHeight(engine.createMeasureContext())).toBe(12);
  });

  it('render แค่ advance cursor y ไม่แตะ doc', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new SpacerBlock({ type: 'spacer', height: 12 });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(ctx.cursor.y).toBe(15 + 12);
    expect(stub.text).not.toHaveBeenCalled();
    expect(stub.setFontSize).not.toHaveBeenCalled();
  });

  it('height ติดลบ/NaN → throw KapomLayoutError ตอนสร้าง', () => {
    expect(() => new SpacerBlock({ type: 'spacer', height: -1 })).toThrow(
      KapomLayoutError,
    );
    expect(() => new SpacerBlock({ type: 'spacer', height: Number.NaN })).toThrow(
      KapomLayoutError,
    );
  });

  it('height เป็น 0 คือค่าที่ถูกกฎ', () => {
    expect(() => new SpacerBlock({ type: 'spacer', height: 0 })).not.toThrow();
  });

  it('ไม่ระบุ height → ใช้ DEFAULT_SPACER_HEIGHT (zero-config)', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new SpacerBlock({ type: 'spacer' });

    expect(block.measureHeight(engine.createMeasureContext())).toBe(DEFAULT_SPACER_HEIGHT);
  });
});

describe('spacer() shorthand', () => {
  it('คืน SpacerNode ที่มี height ตามที่ส่ง', () => {
    expect(spacer(4)).toEqual({ type: 'spacer', height: 4 });
  });

  it('ไม่ส่ง arg → คืน node ไม่มี height (ให้ block เติม default)', () => {
    expect(spacer()).toEqual({ type: 'spacer' });
  });
});
