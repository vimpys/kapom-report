import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { DEFAULT_ROW_GAP, resolveRowColumnWidths, RowBlock } from '../../src/blocks/row-block';
import { DEFAULT_TEXT_STYLE, TextBlock } from '../../src/blocks/text-block';
import { KapomError, KapomLayoutError } from '../../src/core/errors';
import { RenderEngine } from '../../src/core/engine';
import type { RowNode } from '../../src/types/node';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

const LINE_HEIGHT = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;

describe('resolveRowColumnWidths (pure)', () => {
  it('fixed + flex: ช่องที่ไม่ระบุ width แบ่งพื้นที่ที่เหลือเท่ากัน (หัก gap แล้ว)', () => {
    // contentWidth 180, fixed 50, gap 4×2 = 8 → flex 2 ช่อง ๆ ละ (180-50-8)/2 = 61
    const resolved = resolveRowColumnWidths([50, undefined, undefined], 180, 4);
    expect(resolved).toEqual([
      { x: 0, width: 50 },
      { x: 54, width: 61 },
      { x: 119, width: 61 },
    ]);
  });

  it('fixed ล้วน: ตำแหน่ง x เว้น gap ระหว่างช่อง', () => {
    const resolved = resolveRowColumnWidths([30, 40], 180, 10);
    expect(resolved).toEqual([
      { x: 0, width: 30 },
      { x: 40, width: 40 },
    ]);
  });

  it('fixed + gap เกิน contentWidth → throw KapomLayoutError', () => {
    expect(() => resolveRowColumnWidths([100, 100], 180, 4)).toThrow(KapomLayoutError);
  });

  it('fixed กิน space หมดจน flex ไม่เหลือที่ → throw KapomLayoutError', () => {
    expect(() => resolveRowColumnWidths([180, undefined], 180, 4)).toThrow(KapomLayoutError);
  });
});

describe('RowBlock — validation (ผ่าน registry factory)', () => {
  it('columns ว่าง → throw KapomError', () => {
    expect(() => createBlock({ type: 'row', columns: [] })).toThrow(KapomError);
  });

  it('column width <= 0 → throw KapomLayoutError', () => {
    expect(() =>
      createBlock({ type: 'row', columns: [{ width: 0, children: ['x'] }] }),
    ).toThrow(KapomLayoutError);
  });

  it('gap ติดลบ → throw KapomLayoutError', () => {
    expect(() =>
      createBlock({ type: 'row', gap: -1, columns: [{ children: ['x'] }] }),
    ).toThrow(KapomLayoutError);
  });

  it('table ใน column → throw KapomError (v1 ยังไม่รองรับ block ที่ paginate เอง)', () => {
    expect(() =>
      createBlock({
        type: 'row',
        columns: [{ children: [{ type: 'table', columns: [], data: [] }] }],
      }),
    ).toThrow(KapomError);
  });

  it('table ที่ซ่อนอยู่ใน stack ใน column → ยัง throw (เช็ค recursive)', () => {
    expect(() =>
      createBlock({
        type: 'row',
        columns: [
          {
            children: [
              { type: 'stack', children: [{ type: 'table', columns: [], data: [] }] },
            ],
          },
        ],
      }),
    ).toThrow(KapomError);
  });

  it('section ใน column → throw KapomError (forcePageBreak ขัดกับ keep-together box)', () => {
    expect(() =>
      createBlock({
        type: 'row',
        columns: [{ children: [{ type: 'section', name: 's', children: ['x'] }] }],
      }),
    ).toThrow(KapomError);
  });

  it('text shorthand (string/object ไม่มี type) ใน column ใช้ได้ปกติ', () => {
    expect(() =>
      createBlock({
        type: 'row',
        columns: [{ children: ['plain', { content: 'no type', style: { fontSize: 8 } }] }],
      }),
    ).not.toThrow();
  });
});

describe('RowBlock — measureHeight', () => {
  it('สูงเท่าคอลัมน์ที่สูงที่สุด (ไม่ใช่ผลรวมทุกคอลัมน์)', () => {
    const { doc } = makeStubDoc(['line1']); // ทุก text = 1 บรรทัด
    const engine = new RenderEngine(doc);
    const oneLine = new TextBlock({ type: 'text', content: 'a' });
    const block = new RowBlock(
      [
        { width: undefined, blocks: [oneLine] },
        { width: undefined, blocks: [oneLine, oneLine, oneLine] }, // 3 บรรทัด — สูงสุด
      ],
      DEFAULT_ROW_GAP,
    );

    const height = block.measureHeight(engine.createMeasureContext());

    expect(height).toBeCloseTo(3 * LINE_HEIGHT, 6);
  });
});

describe('RowBlock — render', () => {
  it('วาดแต่ละคอลัมน์ที่ x ของตัวเอง โดยทุกคอลัมน์เริ่มที่หัว row เดียวกัน', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    // margins.left 15, contentWidth 180: col0 fixed 50 → x=15; col1 flex → x = 15+50+4 = 69
    const block = new RowBlock(
      [
        { width: 50, blocks: [new TextBlock({ type: 'text', content: 'a' })] },
        { width: undefined, blocks: [new TextBlock({ type: 'text', content: 'b' })] },
      ],
      DEFAULT_ROW_GAP,
    );

    block.render(engine.createRenderContext());

    // ทั้งสองคอลัมน์ baseline เดียวกัน (เริ่มที่ top ของ row ทั้งคู่ ไม่ไหลต่อกันแนวตั้ง)
    expect(stub.text).toHaveBeenNthCalledWith(1, ['line1'], 15, 15 + LINE_HEIGHT);
    expect(stub.text).toHaveBeenNthCalledWith(2, ['line1'], 69, 15 + LINE_HEIGHT);
  });

  it('cursor จริง advance ครั้งเดียวเท่าความสูงคอลัมน์ที่สูงสุด', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const oneLine = new TextBlock({ type: 'text', content: 'a' });
    const block = new RowBlock(
      [
        { width: undefined, blocks: [oneLine] },
        { width: undefined, blocks: [oneLine, oneLine] },
      ],
      DEFAULT_ROW_GAP,
    );
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(ctx.cursor.y).toBeCloseTo(15 + 2 * LINE_HEIGHT, 6);
  });

  it('ลูกหลายตัวในคอลัมน์เดียวไหลลงตามลำดับภายในคอลัมน์ (advanceY เฉพาะคอลัมน์ตัวเอง)', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new RowBlock(
      [
        {
          width: undefined,
          blocks: [
            new TextBlock({ type: 'text', content: 'a' }),
            new TextBlock({ type: 'text', content: 'b' }),
          ],
        },
      ],
      DEFAULT_ROW_GAP,
    );

    block.render(engine.createRenderContext());

    expect(stub.text).toHaveBeenNthCalledWith(1, ['line1'], 15, 15 + LINE_HEIGHT);
    expect(stub.text).toHaveBeenNthCalledWith(2, ['line1'], 15, 15 + 2 * LINE_HEIGHT);
  });

  it('keep-together: พื้นที่เหลือไม่พอทั้ง row → ขึ้นหน้าใหม่ก่อนวาด (ensureSpace ทั้งก้อน)', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();
    // ดัน cursor ไปจนเหลือน้อยกว่า 2 บรรทัด (contentBottom = 297-15 = 282)
    ctx.advanceY(282 - 15 - LINE_HEIGHT); // เหลือพอดี 1 บรรทัด
    const oneLine = new TextBlock({ type: 'text', content: 'a' });
    const block = new RowBlock([{ width: undefined, blocks: [oneLine, oneLine] }], DEFAULT_ROW_GAP);

    block.render(ctx);

    expect(stub.addPage).toHaveBeenCalledTimes(1);
    // เริ่มที่หัวหน้าใหม่ (top = 15) แล้ว advance 2 บรรทัด
    expect(ctx.cursor.y).toBeCloseTo(15 + 2 * LINE_HEIGHT, 6);
  });

  it('align ภายในคอลัมน์อ้าง contentWidth ของคอลัมน์ ไม่ใช่ของทั้งหน้า', () => {
    const { stub, doc } = makeStubDoc(['line1']); // กว้าง 10 (len*2)
    const engine = new RenderEngine(doc);
    const block = new RowBlock(
      [
        { width: 100, blocks: [new TextBlock({ type: 'text', content: 'a', align: 'right' })] },
      ],
      DEFAULT_ROW_GAP,
    );

    block.render(engine.createRenderContext());

    // ชิดขวาของคอลัมน์กว้าง 100: x = 15 + 100 - 10 = 105 (ไม่ใช่ 15 + 180 - 10)
    expect(stub.text).toHaveBeenCalledWith('line1', 105, 15 + LINE_HEIGHT);
  });
});

describe('RowBlock — ผ่าน registry + engine เต็มวง', () => {
  it('render ผ่าน engine.render ด้วย node จริงไม่ throw', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const node: RowNode<unknown> = {
      type: 'row',
      columns: [
        { width: 40, children: ['left column'] },
        { children: [{ content: 'right column', align: 'right' }] },
      ],
    };

    expect(() => engine.render([createBlock(node)])).not.toThrow();
  });
});
