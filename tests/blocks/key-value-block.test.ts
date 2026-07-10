import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { KeyValueBlock } from '../../src/blocks/key-value-block';
import { DEFAULT_TEXT_STYLE } from '../../src/blocks/text-block';
import { KapomError, KapomLayoutError } from '../../src/core/errors';
import { RenderEngine } from '../../src/core/engine';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

const LINE_HEIGHT = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;

describe('KeyValueBlock — validation', () => {
  it('rows ว่าง → throw KapomError', () => {
    expect(() => createBlock({ type: 'keyValue', rows: [] })).toThrow(KapomError);
  });

  it('labelWidth <= 0 → throw KapomLayoutError', () => {
    expect(() =>
      createBlock({ type: 'keyValue', rows: [['a', 'b']], labelWidth: 0 }),
    ).toThrow(KapomLayoutError);
  });
});

describe('KeyValueBlock — measureHeight', () => {
  it('สูง = จำนวนแถว × line-height (แถวละบรรทัดเดียว ไม่มี wrap)', () => {
    const { doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({
      type: 'keyValue',
      rows: [
        ['Date:', '2026-07-10'],
        ['No:', 'QT-42'],
        ['Valid:', '30 days'],
      ],
    });

    const height = block.measureHeight(engine.createMeasureContext());

    expect(height).toBeCloseTo(3 * LINE_HEIGHT, 6);
  });
});

describe('KeyValueBlock — render', () => {
  it('label เป็น bold โดย default, value เป็น normal', () => {
    const { stub, doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({ type: 'keyValue', rows: [['No:', '42']] });

    block.render(engine.createRenderContext());

    expect(stub.setFont).toHaveBeenCalledWith('helvetica', 'bold');
    expect(stub.setFont).toHaveBeenCalledWith('helvetica', 'normal');
  });

  it('labelWidth auto = label ที่กว้างที่สุด + 3; value เริ่มถัดจากนั้น', () => {
    // stub getTextWidth = len*2 → 'Number:' = 14 (กว้างสุด), labelWidth = 17
    const { stub, doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({
      type: 'keyValue',
      rows: [
        ['No:', '42'],
        ['Number:', '43'],
      ],
    });

    block.render(engine.createRenderContext());

    // แถวแรก: label ที่ x=15, value ที่ x = 15 + 17 = 32
    expect(stub.text).toHaveBeenNthCalledWith(1, 'No:', 15, 15 + LINE_HEIGHT);
    expect(stub.text).toHaveBeenNthCalledWith(2, '42', 32, 15 + LINE_HEIGHT);
  });

  it('labelWidth ที่ตั้งเองชนะ auto', () => {
    const { stub, doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({
      type: 'keyValue',
      rows: [['No:', '42']],
      labelWidth: 40,
    });

    block.render(engine.createRenderContext());

    expect(stub.text).toHaveBeenNthCalledWith(2, '42', 55, 15 + LINE_HEIGHT);
  });

  it("valueAlign: 'right' — value ชิดขอบขวาของ contentWidth", () => {
    // contentWidth 180, '42' กว้าง 4 → x = 15 + 180 - 4 = 191
    const { stub, doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({
      type: 'keyValue',
      rows: [['Subtotal', '42']],
      valueAlign: 'right',
    });

    block.render(engine.createRenderContext());

    expect(stub.text).toHaveBeenNthCalledWith(2, '42', 191, 15 + LINE_HEIGHT);
  });

  it('advance cursor = จำนวนแถว × line-height', () => {
    const { doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({
      type: 'keyValue',
      rows: [
        ['a', '1'],
        ['b', '2'],
      ],
    });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(ctx.cursor.y).toBeCloseTo(15 + 2 * LINE_HEIGHT, 6);
  });

  it('normalize label/value ตอนสร้าง (tab/zero-width โดนจัดการก่อนถึง jsPDF)', () => {
    const { stub, doc } = makeStubDoc(['one-line']);
    const engine = new RenderEngine(doc);
    const block = new KeyValueBlock({
      type: 'keyValue',
      rows: [['a\tb', 'c​d']],
    });

    block.render(engine.createRenderContext());

    const drawn = stub.text.mock.calls.map((call) => call[0] as string);
    expect(drawn[0]).not.toContain('\t');
    expect(drawn[1]).not.toContain('​');
  });
});
