import { describe, expect, it } from 'vitest';
import { TableBlock } from '../../src/blocks/table-block';
import { KapomError } from '../../src/core/errors';
import { RenderEngine } from '../../src/core/engine';
import type { TableNode } from '../../src/types/node';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

interface Row {
  name: string;
  amount: string;
}

const node = (extra?: Partial<TableNode<Row>>): TableNode<Row> => ({
  type: 'table',
  columns: [
    { type: 'data', key: 'name', header: 'ชื่อ' },
    { type: 'data', key: 'amount', header: 'ยอด', aggregate: 'sum' },
  ],
  data: [
    { name: 'a', amount: '1.00' },
    { name: 'b', amount: '2.00' },
  ],
  ...extra,
});

describe('TableBlock — validation', () => {
  it('nested ยังไม่รองรับ → throw ตอนสร้าง', () => {
    expect(() => new TableBlock(node({ nested: () => undefined }))).toThrow(KapomError);
  });

  it('group รองรับแล้ว → ไม่ throw', () => {
    expect(() => new TableBlock(node({ group: { by: 'name' } }))).not.toThrow();
  });
});

describe('TableBlock — measureHeight (ค่าประมาณ)', () => {
  it('สเกลตามจำนวนแถว: head 1 + body N + foot 1 (มี aggregate)', () => {
    const { doc } = makeStubDoc(['X']);
    const engine = new RenderEngine(doc);
    const block = new TableBlock(node());

    const height = block.measureHeight(engine.createMeasureContext());

    const lineHeight = (10 * 1.15) / SCALE_FACTOR;
    // 1 head + 2 body + 1 foot = 4 แถว × ratio 1.9
    expect(height).toBeCloseTo(4 * lineHeight * 1.9, 6);
  });

  it('ไม่มี aggregate → ไม่นับ foot', () => {
    const { doc } = makeStubDoc(['X']);
    const engine = new RenderEngine(doc);
    const block = new TableBlock(
      node({
        columns: [{ type: 'data', key: 'name', header: 'ชื่อ' }],
      }),
    );

    const height = block.measureHeight(engine.createMeasureContext());

    const lineHeight = (10 * 1.15) / SCALE_FACTOR;
    expect(height).toBeCloseTo(3 * lineHeight * 1.9, 6);
  });
});
