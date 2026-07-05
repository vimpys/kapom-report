/**
 * Demo — สร้าง PDF จริงด้วย RenderEngine + Text/Spacer/Divider blocks
 * รัน: npm run demo
 * ผลลัพธ์: examples/output/basic-report.pdf
 */
import { jsPDF } from 'jspdf';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RenderEngine, createBlock } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'output');
const outFile = join(outDir, 'basic-report.pdf');

const doc = new jsPDF();
const engine = new RenderEngine(doc);

const repeatedParagraph =
  'ข้อความตัวอย่างสำหรับทดสอบการตัดบรรทัดอัตโนมัติ (word wrap) ของ PdfCursor engine เมื่อความกว้างไม่พอสำหรับหนึ่งบรรทัด engine จะคำนวณจำนวนบรรทัดจริงผ่าน jsPDF splitTextToSize แล้วเลื่อน cursor ลงตามความสูงที่วัดได้ ';

engine.render([
  createBlock({
    type: 'text',
    content: 'Kapom Report — ตัวอย่างรายงานพื้นฐาน',
    style: { fontSize: 18, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock({
    type: 'text',
    content: 'สร้างเมื่อ 2026-07-05 โดย RenderEngine + createBlock()',
    style: { fontSize: 10, color: [100, 100, 100] },
  }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({ type: 'divider' }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({ type: 'text', content: repeatedParagraph.repeat(3) }),
  createBlock({ type: 'spacer', height: 10 }),
  createBlock({ type: 'divider', thickness: 1, color: [200, 0, 0] }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock({
    type: 'text',
    content: 'ทดสอบ auto page-break: บรรทัดซ้ำด้านล่างนี้จะดันเนื้อหาล้นไปหน้าถัดไปโดยอัตโนมัติ',
    style: { fontStyle: 'bold' },
  }),
  ...Array.from({ length: 80 }, (_, i) =>
    createBlock({
      type: 'text',
      content: `บรรทัดทดสอบที่ ${i + 1} — เนื้อหาซ้ำเพื่อยืนยันว่า RenderEngine ขึ้นหน้าใหม่เองเมื่อพื้นที่ไม่พอ`,
    }),
  ),
]);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, Buffer.from(doc.output('arraybuffer')));

console.log(`สร้าง PDF สำเร็จ: ${outFile}`);
console.log(`จำนวนหน้า: ${doc.getNumberOfPages()}`);
