import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { KapomError } from '../../src/core/errors';
import { RenderEngine } from '../../src/core/engine';
import { TableBlock } from '../../src/blocks/table-block';
import type { TableNode } from '../../src/types/node';

interface Master {
  name: string;
  qty: number;
}

interface Detail {
  label: string;
  amount: string;
}

const masters: Master[] = [
  { name: 'A', qty: 1 },
  { name: 'B', qty: 2 },
  { name: 'C', qty: 3 },
];

const detailNode = (label: string): TableNode<Detail> => ({
  type: 'table',
  columns: [
    { key: 'label', header: 'Label' },
    { key: 'amount', header: 'Amount' },
  ],
  data: [{ label, amount: '1.00' }],
});

/** master-detail node whose resolver counts its own calls — every row gets a child */
function countingNode(layout: 'stacked' | 'below', calls: string[]): TableNode<Master> {
  return {
    type: 'table',
    columns: [
      { key: 'name', header: 'Name' },
      { key: 'qty', header: 'Qty' },
    ],
    data: masters,
    nestedLayout: layout,
    nested: (row) => {
      calls.push(row.name);

      return detailNode(row.name) as TableNode<unknown>;
    },
  };
}

describe('TableBlock nested — nested(row) ถูก resolve ครั้งเดียวต่อแถว', () => {
  for (const layout of ['stacked', 'below'] as const) {
    it(`layout '${layout}': measure + render ใช้ผลลัพธ์ร่วมกัน ไม่เรียก callback ซ้ำ`, () => {
      const calls: string[] = [];
      const doc = new jsPDF();
      const engine = new RenderEngine(doc);
      const block = new TableBlock(countingNode(layout, calls));

      // เส้นทางเดียวกับที่ engine ใช้จริง: measure ก่อนตัดสินใจ page-break แล้วค่อย render
      block.measureHeight(engine.createMeasureContext());
      block.render(engine.createRenderContext());

      expect(calls).toEqual(['A', 'B', 'C']); // ไม่ใช่ A,B,C,A,B,C
    });
  }

  it('เรียกผ่าน engine.render() ตรงๆ ก็ยังครั้งเดียวต่อแถว', () => {
    const calls: string[] = [];
    const engine = new RenderEngine(new jsPDF());

    engine.render([new TableBlock(countingNode('below', calls))]);

    expect(calls).toEqual(['A', 'B', 'C']);
  });

  it('ยิ่งลึกยิ่งทวีคูณ: callback ของ "หลาน" ก็ต้องเรียกครั้งเดียวเช่นกัน', () => {
    const childCalls: string[] = [];
    const grandchild: TableNode<Detail> = {
      type: 'table',
      columns: [{ key: 'label', header: 'Label' }],
      data: [{ label: 'leaf', amount: '0' }],
    };
    const child: TableNode<Detail> = {
      type: 'table',
      columns: [{ key: 'label', header: 'Label' }],
      data: [{ label: 'x', amount: '0' }],
      nestedLayout: 'below',
      nested: (row) => {
        childCalls.push(row.label);

        return grandchild as TableNode<unknown>;
      },
    };
    const node: TableNode<Master> = {
      type: 'table',
      columns: [{ key: 'name', header: 'Name' }],
      data: [{ name: 'A', qty: 1 }],
      nestedLayout: 'below',
      nested: () => child as TableNode<unknown>,
    };

    const engine = new RenderEngine(new jsPDF());
    const block = new TableBlock(node);
    block.measureHeight(engine.createMeasureContext());
    block.render(engine.createRenderContext());

    expect(childCalls).toEqual(['x']);
  });
});

describe('TableBlock nested — resolver ที่ไม่มีจุดจบ', () => {
  it('nested ที่คืน child ทุกครั้ง → throw KapomError บอกสาเหตุ ไม่ใช่ stack overflow', () => {
    // resolver นิยามด้วยตัวเอง: ทุกแถวมี child เสมอ ไม่มีวันถึงใบ
    const endless = (): TableNode<Detail> => ({
      type: 'table',
      columns: [{ key: 'label', header: 'Label' }],
      data: [{ label: 'deeper', amount: '0' }],
      nested: () => endless() as TableNode<unknown>,
    });
    const node: TableNode<Master> = {
      type: 'table',
      columns: [{ key: 'name', header: 'Name' }],
      data: [{ name: 'A', qty: 1 }],
      nested: () => endless() as TableNode<unknown>,
    };

    const engine = new RenderEngine(new jsPDF());
    const block = new TableBlock(node);

    expect(() => block.measureHeight(engine.createMeasureContext())).toThrow(KapomError);
    expect(() => block.measureHeight(engine.createMeasureContext())).toThrow(/levels deep/);
  });

  it('ความลึกที่สมเหตุสมผล (3 ชั้น) ยังทำงานปกติ ไม่โดน guard', () => {
    const level3: TableNode<Detail> = {
      type: 'table',
      columns: [{ key: 'label', header: 'Label' }],
      data: [{ label: 'leaf', amount: '0' }],
    };
    const level2: TableNode<Detail> = {
      type: 'table',
      columns: [{ key: 'label', header: 'Label' }],
      data: [{ label: 'mid', amount: '0' }],
      nested: () => level3 as TableNode<unknown>,
    };
    const node: TableNode<Master> = {
      type: 'table',
      columns: [{ key: 'name', header: 'Name' }],
      data: [{ name: 'A', qty: 1 }],
      nested: () => level2 as TableNode<unknown>,
    };

    const engine = new RenderEngine(new jsPDF());
    const block = new TableBlock(node);

    expect(() => {
      block.measureHeight(engine.createMeasureContext());
      block.render(engine.createRenderContext());
    }).not.toThrow();
  });
});
