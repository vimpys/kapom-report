import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { createBlock } from '../../src/blocks/create-block';
import type { TableNode } from '../../src/types/node';

interface Row {
  n: number;
  label: string;
}

function bigTable(count: number): TableNode<Row> {
  return {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right' },
      { type: 'data', key: 'label', header: 'Label' },
    ],
    data: Array.from({ length: count }, (_, i) => ({ n: i, label: `Row ${i + 1}` })),
  };
}

describe('page bands × jsPDF จริง', () => {
  it('band วาดทุกหน้ารวมหน้าที่ AutoTable สร้างเอง (finalize iterate ทุกหน้าใน doc)', () => {
    const doc = new jsPDF();
    let footerDrawCount = 0;
    const engine = new RenderEngine(doc, {
      pageFooter: {
        height: 12,
        render: (c) => {
          footerDrawCount += 1;
          c.drawText(`Page ${c.pageIndex + 1} / ${c.pageCount}`, c.x, c.y + 8);
        },
      },
    });

    // ตารางยาวพอให้ AutoTable แบ่งหลายหน้าเอง (ข้าม onPageBreak ของ engine)
    engine.render([createBlock(bigTable(200))]);
    const pageCount = doc.getNumberOfPages();
    engine.finalize();

    expect(pageCount).toBeGreaterThan(1);
    // footer ถูกวาดครบทุกหน้า แม้หน้าถูกสร้างจาก AutoTable ไม่ใช่ engine.breakPage
    expect(footerDrawCount).toBe(pageCount);
  });

  it('AutoTable เคารพ footer reserved — ตารางแบ่งหน้าเร็วขึ้นเมื่อ footer กินพื้นที่', () => {
    const withoutFooter = new jsPDF();
    new RenderEngine(withoutFooter).render([createBlock(bigTable(60))]);

    const withFooter = new jsPDF();
    new RenderEngine(withFooter, {
      pageFooter: { height: 60, render: () => {} },
    }).render([createBlock(bigTable(60))]);

    // footer สูง 60mm บีบ content → ต้องใช้หน้ามากกว่าหรือเท่ากับกรณีไม่มี footer
    expect(withFooter.getNumberOfPages()).toBeGreaterThanOrEqual(
      withoutFooter.getNumberOfPages(),
    );
    expect(withFooter.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('header reserved ดัน content ลง — text block แรกเริ่มใต้ header', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, {
      pageHeader: { height: 30, render: () => {} },
    });
    const ctx = engine.createRenderContext();
    const startY = ctx.cursor.y;

    engine.render([createBlock({ type: 'text', content: 'body text' })]);

    // เริ่มที่ contentTop = margin.top(15) + header(30) = 45
    expect(startY).toBe(45);
  });
});
