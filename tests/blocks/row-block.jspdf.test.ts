import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { ReportNode } from '../../src/types/node';

describe('RowBlock/KeyValueBlock × jsPDF จริง', () => {
  it('row + keyValue + text align ประกอบกันเป็นหน้าเอกสารจริงได้ไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const blocks: ReportNode[] = [
      {
        type: 'row',
        columns: [
          {
            children: [
              { type: 'text', content: 'COMPANY NAME', style: { fontSize: 12, fontStyle: 'bold' } },
            ],
          },
          {
            children: [
              { type: 'text', content: '123 Anywhere St.', align: 'right', style: { fontSize: 8 } },
              { type: 'text', content: 'contact@example.com', align: 'right', style: { fontSize: 8 } },
            ],
          },
        ],
      },
      { type: 'text', content: 'QUOTATION', align: 'center', style: { fontSize: 22, fontStyle: 'bold' } },
      {
        type: 'row',
        columns: [
          {
            children: [
              {
                type: 'keyValue',
                rows: [
                  ['Quote No:', 'QT-0042'],
                  ['Date:', '2026-07-10'],
                ],
              },
            ],
          },
          { children: ['Customer Name'] },
        ],
      },
      { type: 'keyValue', rows: [['Subtotal', '9,200.00']], valueAlign: 'right' },
    ];

    expect(() => engine.render(blocks.map((node) => createBlock(node)))).not.toThrow();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('เนื้อหายาวใน row (paragraph wrap ในคอลัมน์แคบ) — ความสูงวัดจาก width ของคอลัมน์จริง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const paragraph = 'A fairly long paragraph that will definitely wrap across multiple lines when constrained. '.repeat(3);

    const narrow = createBlock({
      type: 'row',
      columns: [
        { width: 52, children: ['LABEL'] },
        { children: [paragraph] },
      ],
    } satisfies ReportNode);
    const fullWidth = createBlock({ type: 'text', content: paragraph });

    const ctx = engine.createMeasureContext();
    // คอลัมน์แคบกว่าเต็มหน้า → ต้อง wrap มากกว่า → row สูงกว่า text เต็มความกว้าง
    expect(narrow.measureHeight(ctx)).toBeGreaterThan(fullWidth.measureHeight(ctx));
  });
});
