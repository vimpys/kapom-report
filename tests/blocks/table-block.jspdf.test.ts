import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { TableNode } from '../../src/types/node';

interface Sale {
  no?: never;
  product: string;
  qty: number;
  price: string;
}

function makeSales(count: number): Sale[] {
  return Array.from({ length: count }, (_, i) => ({
    product: `Product ${i + 1}`,
    qty: (i % 5) + 1,
    price: `${(i % 100) + 1}.25`,
  }));
}

function tableNode(data: Sale[]): TableNode<Sale> {
  return {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right' },
      { type: 'data', key: 'product', header: 'Product' },
      { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { type: 'data', key: 'price', header: 'Price', align: 'right', numberFormat: {}, aggregate: 'sum' },
    ],
    data,
    summaryLabel: 'Total',
  };
}

describe('TableBlock × jsPDF + AutoTable จริง', () => {
  it('ตารางสั้น: วาดจบหน้าเดียว, cursor sync ไป finalY', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(tableNode(makeSales(5)))]);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.lastAutoTable?.finalY).toBeDefined();
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
    expect(ctx.cursor.y).toBeGreaterThan(15); // เลื่อนลงจาก margin top จริง
    expect(ctx.cursor.pageIndex).toBe(0);
  });

  it('ตารางยาว: AutoTable แบ่งหน้าเอง → cursor.pageIndex ตามหน้าสุดท้ายจริง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(tableNode(makeSales(200)))]);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(ctx.cursor.pageIndex).toBe(doc.getNumberOfPages() - 1);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
  });

  it('block ถัดจากตารางเริ่มวาดต่อจาก finalY บนหน้าสุดท้าย ไม่ทับตาราง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    const recorded: Array<{ y: number; pageIndex: number }> = [];
    engine.render([
      createBlock(tableNode(makeSales(60))),
      {
        measureHeight: () => 10,
        render: (c) => {
          recorded.push({ y: c.cursor.y, pageIndex: c.cursor.pageIndex });
          c.advanceY(10);
        },
      },
    ]);

    const tableEndPage = doc.getNumberOfPages() - 1;
    expect(recorded).toHaveLength(1);
    const after = recorded[0];
    expect(after).toBeDefined();
    // block ถัดไปต้องอยู่หน้าเดียวกับ (หรือถัดจาก) จุดจบตาราง และไม่อยู่เหนือ finalY
    expect(after?.pageIndex).toBeGreaterThanOrEqual(tableEndPage);
    expect(ctx.cursor.pageIndex).toBeGreaterThanOrEqual(tableEndPage);
  });

  it('ตารางสองตัวต่อกัน: ตัวที่สอง startY ต่อจากตัวแรก', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(tableNode(makeSales(3)))]);
    const firstEnd = ctx.cursor.y;

    engine.render([createBlock(tableNode(makeSales(3)))]);

    expect(ctx.cursor.y).toBeGreaterThan(firstEnd);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

interface CategorizedSale extends Sale {
  category: string;
}

function groupedNode(
  data: CategorizedSale[],
  keepTogether?: { minRowsWithHeader: number },
): TableNode<CategorizedSale> {
  return {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right', mode: 'per-group' },
      { type: 'data', key: 'product', header: 'Product' },
      { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { type: 'data', key: 'price', header: 'Price', align: 'right', numberFormat: {}, aggregate: 'sum' },
    ],
    data,
    summaryLabel: 'Grand Total',
    group: {
      by: 'category',
      headerLabel: (key, rows) => `${key} — ${rows.length} items`,
      ...(keepTogether ? { keepTogether } : {}),
    },
  };
}

function makeCategorized(perGroup: number, categories: string[]): CategorizedSale[] {
  return categories.flatMap((category) =>
    makeSales(perGroup).map((s) => ({ ...s, category })),
  );
}

describe('TableBlock (grouped) × jsPDF + AutoTable จริง', () => {
  it('หลายกลุ่ม + grand total: render จบ cursor sync ถูกต้อง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(groupedNode(makeCategorized(4, ['Alpha', 'Beta', 'Gamma'])))]);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
    expect(ctx.cursor.pageIndex).toBe(0);
  });

  it('กลุ่มใหญ่ข้ามหลายหน้า → cursor ตามหน้าสุดท้าย', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(groupedNode(makeCategorized(60, ['Alpha', 'Beta'])))]);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(ctx.cursor.pageIndex).toBe(doc.getNumberOfPages() - 1);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
  });

  it('keep-together: กลุ่มที่เริ่มใกล้ท้ายหน้า → break ไปเริ่มหน้าใหม่ทั้งก้อน (band ไม่ orphan)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    // ดัน cursor ไปใกล้ท้ายหน้า (เหลือ ~10mm — ไม่พอ band+head+3 แถว)
    const contentBottom = 297 - 15;
    engine.render([
      { measureHeight: () => 0, render: (c) => c.advanceY(contentBottom - 15 - 10) },
      createBlock(groupedNode(makeCategorized(5, ['Alpha']), { minRowsWithHeader: 3 })),
    ]);

    expect(doc.getNumberOfPages()).toBe(2);
    // กลุ่มทั้งก้อน (band+ตาราง) อยู่หน้า 2 → จบไม่ไกลจากหัวหน้า
    expect(ctx.cursor.pageIndex).toBe(1);
    expect(ctx.cursor.y).toBeLessThan(100);
  });

  it('block ถัดไปหลัง grouped table ต่อจาก grand total ไม่ทับ', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    const recorded: number[] = [];
    engine.render([
      createBlock(groupedNode(makeCategorized(3, ['Alpha', 'Beta']))),
      {
        measureHeight: () => 5,
        render: (c) => {
          recorded.push(c.cursor.y);
          c.advanceY(5);
        },
      },
    ]);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toBe(doc.lastAutoTable?.finalY);
    expect(ctx.cursor.y).toBeGreaterThan(recorded[0] ?? Number.POSITIVE_INFINITY);
  });
});
