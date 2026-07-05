import { jsPDF, GState } from 'jspdf';
import { describe, expect, it, vi } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { KapomError } from '../../src/core/errors';
import { resolveWatermark, withOpacity } from '../../src/core/watermark';
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

describe('watermark × jsPDF จริง', () => {
  it('วาดทุกหน้ารวมหน้าที่ AutoTable สร้างเอง (finalize iterate ทุกหน้าใน doc)', () => {
    const doc = new jsPDF();
    let drawCount = 0;
    const engine = new RenderEngine(doc, {
      watermark: {
        render: (c) => {
          drawCount += 1;
          c.drawText('DRAFT', c.pageWidth / 2, c.pageHeight / 2);
        },
      },
    });

    // ตารางยาวพอให้ AutoTable แบ่งหลายหน้าเอง (ข้าม onPageBreak ของ engine)
    engine.render([createBlock(bigTable(200))]);
    const pageCount = doc.getNumberOfPages();
    engine.finalize();

    expect(pageCount).toBeGreaterThan(1);
    expect(drawCount).toBe(pageCount);
  });

  it('ใช้ doc.setGState (jsPDF GState) คุม opacity ได้จริงโดยไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, {
      watermark: {
        render: (c) => {
          c.doc.setGState(new GState({ opacity: 0.15 }));
          c.drawText('DRAFT', c.pageWidth / 2, c.pageHeight / 2);
          c.doc.setGState(new GState({ opacity: 1 }));
        },
      },
    });

    engine.render([createBlock({ type: 'text', content: 'body text' })]);

    expect(() => engine.finalize()).not.toThrow();
  });

  it('withOpacity: set opacity ก่อนวาด แล้ว reset กลับ 1 เสมอ (helper แทนการ import GState เอง)', () => {
    const doc = new jsPDF();
    const setGState = vi.spyOn(doc, 'setGState');
    let drawn = false;

    withOpacity(doc, 0.15, () => {
      drawn = true;
    });

    expect(drawn).toBe(true);
    expect(setGState).toHaveBeenCalledTimes(2); // set 0.15 → reset 1
  });

  it('withOpacity: reset opacity กลับ 1 แม้ draw callback throw', () => {
    const doc = new jsPDF();
    const setGState = vi.spyOn(doc, 'setGState');

    expect(() =>
      withOpacity(doc, 0.15, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(setGState).toHaveBeenCalledTimes(2); // finally ยัง reset เสมอ
  });

  it('preset { text } (ค้างแก้ #2): วาดทุกหน้าด้วย opacity ที่คุมให้เอง — ไม่ต้องเขียน render callback', () => {
    const doc = new jsPDF();
    const setGState = vi.spyOn(doc, 'setGState');
    const engine = new RenderEngine(doc, { watermark: { text: 'DRAFT' } });

    engine.render([createBlock(bigTable(200))]);
    const pageCount = doc.getNumberOfPages();
    engine.finalize();

    expect(pageCount).toBeGreaterThan(1);
    // withOpacity ต่อหน้า: set opacity + reset = 2 ครั้ง
    expect(setGState).toHaveBeenCalledTimes(pageCount * 2);
  });

  it('preset: showOnFirstPage false → หน้าแรกไม่วาด', () => {
    const doc = new jsPDF();
    const setGState = vi.spyOn(doc, 'setGState');
    const engine = new RenderEngine(doc, {
      watermark: { text: 'DRAFT', showOnFirstPage: false },
    });

    engine.render([createBlock(bigTable(200))]);
    const pageCount = doc.getNumberOfPages();
    engine.finalize();

    expect(setGState).toHaveBeenCalledTimes((pageCount - 1) * 2);
  });

  it('preset: validate fail-fast — text ว่าง / opacity นอกช่วง / fontSize ติดลบ → throw KapomError', () => {
    expect(() => resolveWatermark({ text: '  ' })).toThrow(KapomError);
    expect(() => resolveWatermark({ text: 'DRAFT', opacity: 1.5 })).toThrow(KapomError);
    expect(() => resolveWatermark({ text: 'DRAFT', fontSize: -1 })).toThrow(KapomError);
  });

  it('preset: render callback เต็มรูป (Watermark เดิม) ผ่าน resolveWatermark ตรงไม่ถูกแตะ', () => {
    const watermark = { render: vi.fn() };
    expect(resolveWatermark(watermark)).toBe(watermark);
  });

  it('ไม่กระทบ content area — ตารางไม่ใช้พื้นที่มากขึ้นเมื่อมี watermark', () => {
    const withoutWatermark = new jsPDF();
    new RenderEngine(withoutWatermark).render([createBlock(bigTable(60))]);

    const withWatermark = new jsPDF();
    new RenderEngine(withWatermark, {
      watermark: { render: (c) => c.drawText('DRAFT', 50, 150) },
    }).render([createBlock(bigTable(60))]);

    expect(withWatermark.getNumberOfPages()).toBe(withoutWatermark.getNumberOfPages());
  });
});
