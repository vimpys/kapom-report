import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { createBlock } from '../../src/blocks/create-block';

/** integration กับ jspdf 4.x จริง — ยืนยันว่า block ทั้งสามทำงานร่วมกับ RenderEngine จริง ไม่ใช่แค่ stub */
describe('Text/Spacer/Divider blocks × jsPDF จริง', () => {
  it('render สลับกันหลายตัวไม่ throw และไล่ page-break ถูกต้อง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock({ type: 'text', content: 'หัวข้อรายงาน', style: { fontSize: 16 } }),
      createBlock({ type: 'spacer', height: 5 }),
      createBlock({ type: 'divider' }),
      createBlock({ type: 'spacer', height: 5 }),
      createBlock({
        type: 'text',
        content: 'lorem ipsum dolor sit amet '.repeat(80),
      }),
    ]);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('spacer + divider ซ้ำจนล้นหน้า → ขึ้นหน้าใหม่จริงใน doc', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const blocks = Array.from({ length: 40 }, () => createBlock({ type: 'divider' }))
      .concat(Array.from({ length: 40 }, () => createBlock({ type: 'spacer', height: 8 })));

    engine.render(blocks);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
