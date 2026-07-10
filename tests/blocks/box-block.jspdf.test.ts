import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { ReportNode } from '../../src/types/node';

describe('BoxBlock × jsPDF จริง', () => {
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
