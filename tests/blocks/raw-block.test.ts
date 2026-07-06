import { describe, expect, it, vi } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { RawBlock } from '../../src/blocks/raw-block';
import { createBlock } from '../../src/blocks/create-block';
import { KapomLayoutError } from '../../src/core/errors';
import type { RawNode } from '../../src/types/node';
import { makeStubDoc } from '../helpers/stub-doc';

function rawNode(overrides: Partial<RawNode> = {}): RawNode {
  return {
    type: 'raw',
    measure: () => 20,
    draw: () => {},
    ...overrides,
  };
}

describe('RawBlock', () => {
  it('measureHeight delegates to node.measure with the content width', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc); // A4 mm → contentWidth = 210 - 15 - 15 = 180
    const measure = vi.fn(() => 30);
    const block = new RawBlock(rawNode({ measure }));

    expect(block.measureHeight(engine.createMeasureContext())).toBe(30);
    expect(measure).toHaveBeenCalledWith(180);
  });

  it('render calls node.draw with the doc, cursor position, and content width, then advances y', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const draw = vi.fn();
    const block = new RawBlock(rawNode({ measure: () => 25, draw }));
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(draw).toHaveBeenCalledWith(doc, { x: 15, y: 15, contentWidth: 180 });
    expect(ctx.cursor.y).toBe(15 + 25); // advanced by the measured height
  });

  it('measure returning a negative / NaN value → throw KapomLayoutError', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const measureCtx = engine.createMeasureContext();

    expect(() => new RawBlock(rawNode({ measure: () => -1 })).measureHeight(measureCtx)).toThrow(
      KapomLayoutError,
    );
    expect(() =>
      new RawBlock(rawNode({ measure: () => Number.NaN })).measureHeight(measureCtx),
    ).toThrow(KapomLayoutError);
  });

  it("createBlock({ type: 'raw', ... }) resolves via the registry (the escape hatch is wired, not a trap)", () => {
    expect(createBlock(rawNode())).toBeInstanceOf(RawBlock);
  });

  it('auto page-break: a raw block taller than the remaining space breaks before draw', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const drawnAt: Array<{ y: number; pageIndex: number }> = [];

    engine.render([
      // fills most of the page (content area = 297 - 15 - 15 = 267)
      createBlock(rawNode({ measure: () => 250, draw: () => {} })),
      // 30 doesn't fit in the remaining ~17 → engine breaks to a new page first
      createBlock(
        rawNode({
          measure: () => 30,
          draw: (_doc, cursor) => drawnAt.push({ y: cursor.y, pageIndex: 0 }),
        }),
      ),
    ]);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    expect(drawnAt[0]?.y).toBe(15); // second block drew at the top of the new page
  });
});
