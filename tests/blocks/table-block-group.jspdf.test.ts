import { jsPDF } from 'jspdf';
import type { CellDef, UserOptions } from 'jspdf-autotable';
import { describe, expect, it, vi } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { TableColumn } from '../../src/types/column';
import type { TableNode } from '../../src/types/node';

// capture the options handed to autoTable (ESM namespace isn't configurable — vi.mock + importOriginal)
const autoTableCalls: UserOptions[] = [];
vi.mock('jspdf-autotable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf-autotable')>();
  return {
    ...actual,
    autoTable: (doc: jsPDF, options: UserOptions) => {
      autoTableCalls.push(options);
      return actual.autoTable(doc, options);
    },
  };
});

interface Row {
  a: string;
  b: string;
  c: string;
  d: string;
}

function render(columns: TableColumn<Row>[]): UserOptions {
  autoTableCalls.length = 0;
  const doc = new jsPDF();
  const engine = new RenderEngine(doc);
  const node: TableNode<Row> = { type: 'table', columns, data: [{ a: '1', b: '2', c: '3', d: '4' }] };
  engine.render([createBlock(node)]);
  const call = autoTableCalls[0];
  if (!call) throw new Error('autoTable was not called');
  return call;
}

describe('TableBlock × column group (spanned header) × jsPDF จริง', () => {
  it('มี group → หัว 2 แถว: group cell colSpan = จำนวนลูก, คอลัมน์เดี่ยว rowSpan 2', () => {
    const options = render([
      { type: 'data', key: 'a', header: 'A' },
      { type: 'group', header: 'Quarterly', columns: [
        { type: 'data', key: 'b', header: 'B' },
        { type: 'data', key: 'c', header: 'C' },
      ]},
      { type: 'data', key: 'd', header: 'D' },
    ]);

    const head = options.head as CellDef[][];
    expect(head).toHaveLength(2); // 2 แถว

    // แถวบน: A(rowSpan2) | Quarterly(colSpan2) | D(rowSpan2)
    const [colA, colGroup, colD] = head[0] ?? [];
    expect(colA?.rowSpan).toBe(2);
    expect(colGroup?.content).toBe('Quarterly');
    expect(colGroup?.colSpan).toBe(2);
    expect(colGroup?.styles?.halign).toBe('center'); // default group align
    expect(colD?.rowSpan).toBe(2);

    // แถวล่าง: เฉพาะลูกของ group (B, C)
    expect((head[1] ?? []).map((c) => c.content)).toEqual(['B', 'C']);
  });

  it('คอลัมน์เดี่ยว rowSpan 2 → valign middle (จัดกลางแนวตั้งในเซลล์ 2 แถว) + halign ตาม headerAlign', () => {
    const options = render([
      { type: 'data', key: 'a', header: 'A', headerAlign: 'center' },
      { type: 'group', header: 'G', columns: [
        { type: 'data', key: 'b', header: 'B' },
        { type: 'data', key: 'c', header: 'C' },
      ]},
      { type: 'data', key: 'd', header: 'D' },
    ]);

    const head = options.head as CellDef[][];
    expect(head[0]?.[0]?.styles?.valign).toBe('middle'); // A rowSpan cell
    expect(head[0]?.[0]?.styles?.halign).toBe('center'); // headerAlign 'center'
  });

  it('ไม่มี group → หัวแถวเดียว (backward compatible, string[])', () => {
    const options = render([
      { type: 'data', key: 'a', header: 'A' },
      { type: 'data', key: 'b', header: 'B' },
    ]);

    expect(options.head).toEqual([['A', 'B']]);
  });

  it('body ยังใช้ leaf columns ปกติ (group ไม่กระทบข้อมูล)', () => {
    const options = render([
      { type: 'data', key: 'a', header: 'A' },
      { type: 'group', header: 'G', columns: [
        { type: 'data', key: 'b', header: 'B' },
        { type: 'data', key: 'c', header: 'C' },
      ]},
      { type: 'data', key: 'd', header: 'D' },
    ]);

    // 4 leaf columns → body row มี 4 ช่อง เรียงตาม leaf (a,b,c,d)
    expect(options.body).toEqual([['1', '2', '3', '4']]);
  });

  it('group.headerAlign override align ของ super-header ได้', () => {
    const options = render([
      { type: 'group', header: 'G', headerAlign: 'left', columns: [
        { type: 'data', key: 'a', header: 'A' },
        { type: 'data', key: 'b', header: 'B' },
      ]},
      { type: 'data', key: 'c', header: 'C' },
      { type: 'data', key: 'd', header: 'D' },
    ]);

    const head = options.head as CellDef[][];
    expect(head[0]?.[0]?.styles?.halign).toBe('left');
  });
});
