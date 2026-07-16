import { jsPDF } from 'jspdf';
import type { CellDef, UserOptions } from 'jspdf-autotable';
import { describe, expect, it, vi } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { TableBlock } from '../../src/blocks/table-block';
import { RenderEngine } from '../../src/core/engine';
import type { TableNode } from '../../src/types/node';

// ESM module namespaces aren't configurable, so vi.spyOn can't wrap a named export directly —
// vi.mock + importOriginal lets us call through to the real implementation while still recording calls
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

interface Batch {
  batchName: string;
  bank: string;
  qty: number;
  payments?: Payment[];
}

interface Payment {
  date: string;
  amount: string;
}

function batches(overrides: Partial<Batch>[] = []): Batch[] {
  const base: Batch[] = [
    { batchName: 'A', bank: 'Ally', qty: 1 },
    { batchName: 'B', bank: 'Ally', qty: 2 },
    { batchName: 'C', bank: 'Ally', qty: 3 },
  ];
  return base.map((row, i) => ({ ...row, ...overrides[i] }));
}

function batchNode(data: Batch[], extra: Partial<TableNode<Batch>> = {}): TableNode<Batch> {
  return {
    type: 'table',
    columns: [
      { type: 'data', key: 'batchName', header: 'Batch' },
      { type: 'data', key: 'bank', header: 'Bank' },
      { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
    ],
    data,
    nested: (row) =>
      row.payments
        ? ({
            type: 'table',
            columns: [
              { type: 'data', key: 'date', header: 'Date' },
              { type: 'data', key: 'amount', header: 'Amount', align: 'right' },
            ],
            data: row.payments,
          } satisfies TableNode<Payment> as unknown as TableNode<unknown>)
        : undefined,
    ...extra,
  };
}

describe('TableBlock × nested (master-detail) × jsPDF จริง', () => {
  it('แถวที่มี nested ถูกตัด segment: ก่อนหน้า → child → หลังจากนั้น', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, { payments: [{ date: '1/1', amount: '10.00' }] }, {}]);
    engine.render([createBlock(batchNode(data))]);

    // 3 autoTable calls: [rows A,B] segment (B itself has the child, so it's included here first),
    // [payments] child, [row C + grand total foot] segment
    expect(autoTableCalls).toHaveLength(3);
    expect(autoTableCalls[0]?.body).toEqual([
      ['A', 'Ally', '1'],
      ['B', 'Ally', '2'],
    ]);
    expect(autoTableCalls[1]?.head).toEqual([['Date', 'Amount']]);
    expect(autoTableCalls[1]?.body).toEqual([['1/1', '10.00']]);
    expect(autoTableCalls[2]?.body).toEqual([['C', 'Ally', '3']]);
    expect(autoTableCalls[2]?.foot).toBeDefined();
  });

  it('ไม่มีแถวไหน nested เลย → segment เดียวเหมือน flat table ปกติ (ไม่ regress)', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(batchNode(batches()))]);

    expect(autoTableCalls).toHaveLength(1);
    expect(autoTableCalls[0]?.body).toEqual([
      ['A', 'Ally', '1'],
      ['B', 'Ally', '2'],
      ['C', 'Ally', '3'],
    ]);
    expect(autoTableCalls[0]?.foot).toBeDefined();
  });

  it('แถวสุดท้ายมี nested (ไม่มีแถวเหลือให้ foot เกาะ) → grand total วาดเป็นแถวเดี่ยว theme plain', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, {}, { payments: [{ date: '1/1', amount: '10.00' }] }]);
    engine.render([createBlock(batchNode(data))]);

    // [A,B] segment, [payments] child, grand total single-row (theme: 'plain')
    expect(autoTableCalls).toHaveLength(3);
    expect(autoTableCalls[2]?.theme).toBe('plain');
    expect(autoTableCalls[2]?.body).toBeDefined();
  });

  it('nestedIndentColumn: 1 → child table เริ่มชิดซ้ายไกลกว่า master (ไม่ใช่ margin.left เดิม)', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, { payments: [{ date: '1/1', amount: '10.00' }] }, {}]);
    engine.render([createBlock(batchNode(data, { nestedIndentColumn: 1 }))]);

    const masterLeft = autoTableCalls[0]?.margin as { left?: number } | undefined;
    const childLeft = autoTableCalls[1]?.margin as { left?: number } | undefined;
    expect(childLeft?.left ?? 0).toBeGreaterThan(masterLeft?.left ?? 0);
  });

  it('nestedIndentColumn นอกช่วง → throw KapomError', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, { payments: [{ date: '1/1', amount: '10.00' }] }, {}]);
    expect(() =>
      engine.render([createBlock(batchNode(data, { nestedIndentColumn: 99 }))]),
    ).toThrow(/nestedIndentColumn/);
  });

  it('measureHeight รวมความสูงของ child table แบบ recursive (แถวที่มี nested สูงกว่าที่ไม่มี)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createMeasureContext();

    const withoutChild = new TableBlock(batchNode(batches())).measureHeight(ctx);
    const withChild = new TableBlock(
      batchNode(batches([{}, { payments: [{ date: '1/1', amount: '10.00' }] }, {}])),
    ).measureHeight(ctx);

    expect(withChild).toBeGreaterThan(withoutChild);
  });

  it('ไม่ throw กับข้อมูลจริงหลายแถว + rasterize-ready (getNumberOfPages เดินได้ปกติ)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = Array.from({ length: 40 }, (_, i) => ({
      batchName: `Batch ${i + 1}`,
      bank: 'Ally',
      qty: i + 1,
      ...(i === 20 ? { payments: [{ date: '1/1', amount: '10.00' }, { date: '2/1', amount: '20.00' }] } : {}),
    }));

    expect(() => engine.render([createBlock(batchNode(data))])).not.toThrow();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

/** contents of a CellDef row as plain strings — the stacked head/body are CellDef[], not string[] */
const contentsOf = (row: CellDef[] | undefined): unknown[] => (row ?? []).map((cell) => cell.content);
const spansOf = (row: CellDef[] | undefined): (number | undefined)[] => (row ?? []).map((cell) => cell.colSpan);

describe("TableBlock × nestedLayout 'stacked' × jsPDF จริง", () => {
  const oneChild = [{ date: '1/1', amount: '10.00' }];

  it('แถวที่มี child → ตารางเดียว head 3 แถว (master header + identity + child header) + body = child rows', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, { payments: oneChild }, {}]);
    engine.render([createBlock(batchNode(data, { nestedLayout: 'stacked' }))]);

    // [A] plain segment → [B's stacked block] → [C + grand foot]; B ไม่อยู่ใน segment แรก (ต่างจาก 'below')
    expect(autoTableCalls).toHaveLength(3);
    expect(autoTableCalls[0]?.body).toEqual([['A', 'Ally', '1']]);

    const head = autoTableCalls[1]?.head as CellDef[][] | undefined;
    expect(head).toHaveLength(3);
    expect(contentsOf(head?.[0])).toEqual(['Batch', 'Bank', 'Qty']); // master column labels
    expect(contentsOf(head?.[1])).toEqual(['B', 'Ally', '2']); // identity = this master row's own values
    expect(contentsOf(head?.[2])).toEqual(['Date', 'Amount']); // child column labels

    const body = autoTableCalls[1]?.body as CellDef[][] | undefined;
    expect(contentsOf(body?.[0])).toEqual(['1/1', '10.00']);

    expect(autoTableCalls[2]?.body).toEqual([['C', 'Ally', '3']]);
    expect(autoTableCalls[2]?.foot).toBeDefined();
  });

  it('master (3 คอลัมน์) กับ child (2 คอลัมน์) ใช้ grid เดียวกัน — cell สุดท้ายของฝั่งที่สั้นกว่า colSpan เติมเต็ม', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(batchNode(batches([{ payments: oneChild }, {}, {}]), { nestedLayout: 'stacked' })),
    ]);

    const head = autoTableCalls[0]?.head as CellDef[][] | undefined;
    expect(spansOf(head?.[0])).toEqual([1, 1, 1]); // master = 3 คอลัมน์พอดี grid
    expect(spansOf(head?.[2])).toEqual([1, 2]); // child 2 คอลัมน์ → cell สุดท้าย span 2 เติมให้ครบ 3
    const body = autoTableCalls[0]?.body as CellDef[][] | undefined;
    expect(spansOf(body?.[0])).toEqual([1, 2]);
  });

  it('identity อยู่ใน head → AutoTable repeat ให้เองทุกหน้าที่ child ล้นไป (คนอ่านรู้เสมอว่า master ไหน)', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    // child ยาวพอให้ล้นข้ามหน้าแน่ๆ
    const many = Array.from({ length: 80 }, (_, i) => ({ date: `${i + 1}/1`, amount: '10.00' }));
    engine.render([
      createBlock(batchNode(batches([{ payments: many }, {}, {}]), { nestedLayout: 'stacked' })),
    ]);

    const head = autoTableCalls[0]?.head as CellDef[][] | undefined;
    // ทั้ง 3 แถวเป็น head section ของตารางเดียวกัน → AutoTable วาดซ้ำหัวทุกหน้าเอง
    expect(head).toHaveLength(3);
    expect(contentsOf(head?.[1])).toEqual(['A', 'Ally', '1']);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('แถวสุดท้ายมี child → grand total วาดเป็นแถวเดี่ยว theme plain (เหมือน layout below)', () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, {}, { payments: oneChild }]);
    engine.render([createBlock(batchNode(data, { nestedLayout: 'stacked' }))]);

    // [A,B] segment → [C's stacked block] → grand total เดี่ยว
    expect(autoTableCalls).toHaveLength(3);
    expect(autoTableCalls[2]?.theme).toBe('plain');
  });

  it("ไม่ตั้ง nestedLayout → default 'below' พฤติกรรมเดิมเป๊ะ (head แถวเดียว, ไม่ regress)", () => {
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const data = batches([{}, { payments: oneChild }, {}]);
    engine.render([createBlock(batchNode(data))]);

    expect(autoTableCalls[0]?.head).toEqual([['Batch', 'Bank', 'Qty']]); // string[] เดิม ไม่ใช่ CellDef
    expect(autoTableCalls[1]?.head).toEqual([['Date', 'Amount']]); // child เป็นตารางของตัวเอง
  });
});
