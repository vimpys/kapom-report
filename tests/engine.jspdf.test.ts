import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import type { MeasurableBlock } from '../src/core/context';
import { RenderEngine } from '../src/core/engine';

/**
 * Integration กับ jspdf 4.x จริง — ยืนยันว่า surface ที่ engine พึ่ง
 * (pageSize/scaleFactor/splitTextToSize/addPage) ตรงกับของจริง ไม่ใช่แค่ stub
 */
describe('RenderEngine × jsPDF จริง', () => {
  it('measureText วัดจาก splitTextToSize จริง — ข้อความยาวสูงกว่าข้อความสั้น', () => {
    const doc = new jsPDF(); // A4 portrait, unit mm
    const engine = new RenderEngine(doc);
    const ctx = engine.createMeasureContext();

    const oneLine = ctx.measureText('short', 10, ctx.contentWidth);
    const manyLines = ctx.measureText('lorem ipsum '.repeat(60), 10, ctx.contentWidth);

    expect(oneLine).toBeGreaterThan(0);
    expect(manyLines).toBeGreaterThan(oneLine * 3);
  });

  it('page-break เพิ่มหน้าใน doc จริง และวาด text ได้ทุกหน้า', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const tallTextBlock = (label: string, height: number): MeasurableBlock => ({
      measureHeight: () => height,
      render: (ctx) => {
        ctx.doc.text(label, ctx.cursor.x, ctx.cursor.y);
        ctx.advanceY(height);
      },
    });

    engine.render([
      tallTextBlock('page-1-a', 150),
      tallTextBlock('page-1-b', 100), // 250 < 267 ยังหน้าแรก
      tallTextBlock('page-2', 100), // ไม่พอ → หน้า 2
    ]);

    expect(doc.getNumberOfPages()).toBe(2);
  });
});
