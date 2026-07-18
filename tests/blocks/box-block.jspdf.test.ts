import { jsPDF } from 'jspdf';
import { describe, expect, it, vi } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { ReportNode } from '../../src/types/node';

describe('BoxBlock × jsPDF จริง', () => {
  it('radius > 0 → วาดด้วย roundedRect (fill + border) ไม่ใช่ rect เหลี่ยม', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const rounded = vi.spyOn(doc, 'roundedRect');
    const rect = vi.spyOn(doc, 'rect');

    const node: ReportNode = {
      type: 'box',
      background: [205, 231, 208],
      borderColor: [156, 203, 164],
      radius: 2,
      padding: 1.5,
      children: [{ type: 'text', content: 'rounded' }],
    };

    engine.render([createBlock(node)]);

    // fill + border → 2 roundedRect calls, each with rx = ry = 2; no plain rect for the box
    expect(rounded).toHaveBeenCalledTimes(2);
    expect(rounded.mock.calls[0]?.[4]).toBe(2);
    expect(rounded.mock.calls[0]?.[5]).toBe(2);
    expect(rect).not.toHaveBeenCalled();
  });

  it('ไม่ตั้ง radius → วาดด้วย rect เหลี่ยมเหมือนเดิม (backward compatible)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const rounded = vi.spyOn(doc, 'roundedRect');

    const node: ReportNode = {
      type: 'box',
      background: [205, 231, 208],
      padding: 1.5,
      children: [{ type: 'text', content: 'square' }],
    };

    engine.render([createBlock(node)]);

    expect(rounded).not.toHaveBeenCalled();
  });

  it('box สั้นใน row column (รูปแบบ grand-total box ของ demo 16) — หน้าเดียวจบ', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const node: ReportNode = {
      type: 'row',
      columns: [
        { children: [{ type: 'text', content: 'Total', style: { fontStyle: 'bold' } }] },
        {
          width: 40,
          children: [
            {
              type: 'box',
              background: [205, 231, 208],
              padding: 1.5,
              children: [{ type: 'text', content: '9,844.00', align: 'right', style: { fontStyle: 'bold' } }],
            },
          ],
        },
      ],
    };

    expect(() => engine.render([createBlock(node)])).not.toThrow();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('box ยาว (ลูกหลายสิบตัว) แตกข้ามหน้าแบบ clone — ได้ >= 2 หน้าโดยไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const node: ReportNode = {
      type: 'box',
      background: [248, 250, 248],
      borderColor: [178, 214, 186],
      padding: 4,
      children: [
        { type: 'text', content: 'TERMS & CONDITIONS', style: { fontSize: 11, fontStyle: 'bold' } },
        ...Array.from({ length: 80 }, (_, i) => `${i + 1}. Clause number ${i + 1} of the agreement, kept short.`),
      ],
    };

    engine.render([createBlock(node)]);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
});
