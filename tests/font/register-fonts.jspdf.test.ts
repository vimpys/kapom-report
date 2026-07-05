import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { createBlock } from '../../src/blocks/create-block';
import { registerFonts } from '../../src/font/register-fonts';
import type { FontConfig } from '../../src/font/font-config';

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '../fixtures/fonts');

const sarabunRegular = readFileSync(join(fontsDir, 'Sarabun-Regular.ttf'));
const sarabunBold = readFileSync(join(fontsDir, 'Sarabun-Bold.ttf'));

const sarabunConfig: FontConfig = {
  fonts: [
    { family: 'Sarabun', data: new Uint8Array(sarabunRegular), style: 'normal' },
    { family: 'Sarabun', data: new Uint8Array(sarabunBold), style: 'bold' },
  ],
};

/**
 * integration กับ jsPDF 4.x จริง + font TTF ไทยจริง (Sarabun, OFL) — ยืนยันว่า
 * jsPDF's TTFFont parser (ผูกกับ addFont event) parse ไบต์จริงผ่าน ไม่ throw
 * ต่างจาก register-fonts.test.ts ที่ใช้ stub doc (addFont ไม่ parse อะไรเลย)
 */
describe('registerFonts × jsPDF จริง + Sarabun TTF', () => {
  it('addFont parse TTF จริงผ่านโดยไม่ throw และขึ้นทะเบียนใน getFontList', () => {
    const doc = new jsPDF();

    const defaultFamily = registerFonts(doc, sarabunConfig);

    expect(defaultFamily).toBe('Sarabun');
    expect(doc.getFontList()['Sarabun']).toEqual(
      expect.arrayContaining(['normal', 'bold']),
    );
  });

  it('RenderEngine ตั้ง default font ให้ทั้ง doc ตาม defaultFamily ที่ resolve ได้', () => {
    const doc = new jsPDF();
    new RenderEngine(doc, { font: sarabunConfig });

    expect(doc.getFont().fontName).toBe('Sarabun');
  });

  it('วาดข้อความไทยจริงผ่าน TextBlock โดยใช้ font ไทยที่ลงทะเบียน — ไม่ throw, output ได้จริง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { font: sarabunConfig });

    engine.render([
      createBlock({
        type: 'text',
        content: 'สวัสดีครับ ทดสอบข้อความภาษาไทยด้วยฟอนต์ Sarabun ที่ลงทะเบียนจริง',
      }),
      createBlock({
        type: 'text',
        content: 'ตัวหนา',
        style: { fontFamily: 'Sarabun', fontStyle: 'bold' },
      }),
    ]);

    const output = doc.output('arraybuffer');
    expect(output.byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('ตารางที่มี header/cell ภาษาไทย วาดผ่าน AutoTable ได้โดยไม่ throw ด้วย font ไทย', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { font: sarabunConfig });

    engine.render([
      createBlock({
        type: 'table',
        columns: [
          { type: 'data', key: 'name', header: 'ชื่อสินค้า' },
          { type: 'data', key: 'amount', header: 'จำนวนเงิน', align: 'right', aggregate: 'sum' },
        ],
        data: [
          { name: 'สินค้า ก', amount: '100.50' },
          { name: 'สินค้า ข', amount: '200.25' },
        ],
      }),
    ]);

    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });

  it('AutoTable ใช้ font ไทยจริง ไม่ fallback กลับไป helvetica default ของมันเอง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { font: sarabunConfig });

    engine.render([
      createBlock({
        type: 'table',
        columns: [{ type: 'data', key: 'name', header: 'ชื่อ' }],
        data: [{ name: 'แถวทดสอบ' }],
      }),
    ]);

    const headCell = doc.lastAutoTable?.head[0]?.cells['0'];
    const bodyCell = doc.lastAutoTable?.body[0]?.cells['0'];
    expect(headCell?.styles.font).toBe('Sarabun');
    expect(bodyCell?.styles.font).toBe('Sarabun');
  });
});

describe('registerFonts × jsPDF จริง — font ที่มีแค่ variant normal (ไม่มี bold)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ทุก built-in theme ของ AutoTable ตั้ง head/foot fontStyle: 'bold' โดย default —
  // ถ้าไม่เช็คก่อนใช้ jsPDF จะ console.warn "Unable to look up font label" แล้ว fallback
  // เงียบๆ (silent failure ตรงตาม decision เรื่อง fontที่ CLAUDE.md เตือนไว้)
  const normalOnlyConfig: FontConfig = {
    fonts: [{ family: 'Sarabun', data: new Uint8Array(sarabunRegular), style: 'normal' }],
  };

  it('ตารางไม่ throw และไม่ warn เรื่อง missing bold variant', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { font: normalOnlyConfig });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    engine.render([
      createBlock({
        type: 'table',
        columns: [{ type: 'data', key: 'name', header: 'ชื่อ' }],
        data: [{ name: 'แถวทดสอบ' }],
      }),
    ]);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('head cell fallback เป็น fontStyle normal แทนที่จะเป็น bold ที่ไม่มี variant', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { font: normalOnlyConfig });

    engine.render([
      createBlock({
        type: 'table',
        columns: [{ type: 'data', key: 'name', header: 'ชื่อ' }],
        data: [{ name: 'แถวทดสอบ' }],
      }),
    ]);

    expect(doc.lastAutoTable?.head[0]?.cells['0']?.styles.fontStyle).toBe('normal');
  });

  it('grouped table (band + grand total) ก็ไม่ warn เช่นกัน', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { font: normalOnlyConfig });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    engine.render([
      createBlock({
        type: 'table',
        columns: [
          { type: 'data', key: 'category', header: 'หมวด' },
          { type: 'data', key: 'amount', header: 'ยอด', aggregate: 'sum' },
        ],
        data: [
          { category: 'A', amount: 1 },
          { category: 'A', amount: 2 },
          { category: 'B', amount: 3 },
        ],
        group: { by: 'category' },
      }),
    ]);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
