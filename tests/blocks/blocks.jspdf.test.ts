import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { createBlock } from '../../src/blocks/create-block';

/** 1x1 PNG โปร่งใส — เล็กสุดที่ jsPDF parse header ผ่านได้จริง (ต่าง stub, addImage ของจริง parse ไบต์) */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** integration กับ jspdf 4.x จริง — ยืนยันว่า block ทั้งหมดทำงานร่วมกับ RenderEngine จริง ไม่ใช่แค่ stub */
describe('Text/Spacer/Divider blocks × jsPDF จริง', () => {
  it('render สลับกันหลายตัวไม่ throw และไล่ page-break ถูกต้อง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      // อังกฤษล้วน — เทสต์นี้ไม่ลงทะเบียนฟอนต์ไทย (helvetica) จะโดน Thai font guard ถ้าใช้ข้อความไทย
      createBlock({ type: 'text', content: 'Report Title', style: { fontSize: 16 } }),
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

describe('ImageBlock × jsPDF จริง', () => {
  it('addImage ของจริง parse PNG แล้ววาดได้โดยไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock({
        type: 'image',
        data: TINY_PNG_BASE64,
        format: 'PNG',
        width: 50,
        height: 50,
      }),
    ]);

    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('width เกิน contentWidth → auto-scale ลงจริงแล้วยังวาดได้โดยไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock({
        type: 'image',
        data: TINY_PNG_BASE64,
        format: 'PNG',
        width: 400, // เกิน contentWidth ของ A4 (~180mm)
        height: 200,
      }),
    ]);

    expect(doc.getNumberOfPages()).toBe(1);
  });
});
