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

describe('pageNumber × jsPDF จริง', () => {
  it('ไม่ throw และวาดครบทุกหน้ารวมหน้าที่ AutoTable สร้างเอง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { pageNumber: true });

    engine.render([createBlock(bigTable(200))]);
    const pageCount = doc.getNumberOfPages();

    expect(() => engine.finalize()).not.toThrow();
    expect(pageCount).toBeGreaterThan(1);
  });

  it('ไม่กระทบ content area เลย — cursor เริ่มที่ contentTop เดิม (ต่าง pageHeader/pageFooter ที่หักพื้นที่)', () => {
    const withPageNumber = new RenderEngine(new jsPDF(), { pageNumber: true }).createRenderContext();
    const withoutAnything = new RenderEngine(new jsPDF(), {}).createRenderContext();

    expect(withPageNumber.contentTop).toBe(withoutAnything.contentTop);
    expect(withPageNumber.contentBottom).toBe(withoutAnything.contentBottom);
  });

  it('ตำแหน่งต่างกันไม่ throw ครบทั้ง 6 ตำแหน่ง', () => {
    const positions = [
      'top-left',
      'top-center',
      'top-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ] as const;

    for (const position of positions) {
      const doc = new jsPDF();
      const engine = new RenderEngine(doc, { pageNumber: position });
      engine.render([createBlock({ type: 'text', content: 'body' })]);
      expect(() => engine.finalize()).not.toThrow();
    }
  });

  it('ใช้ร่วมกับ pageHeader/pageFooter/watermark พร้อมกันได้', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, {
      pageHeader: { height: 16, render: () => {} },
      pageFooter: { height: 12, render: () => {} },
      watermark: { text: 'DRAFT' },
      pageNumber: 'bottom-right',
    });

    engine.render([createBlock(bigTable(150))]);
    expect(() => engine.finalize()).not.toThrow();
  });
});
