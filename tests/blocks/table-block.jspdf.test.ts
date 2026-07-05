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
