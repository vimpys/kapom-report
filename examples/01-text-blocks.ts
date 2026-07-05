/**
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * โฟกัส: style override, word-wrap อัตโนมัติ, auto page-break, image auto-scale
 */
import { jsPDF } from 'jspdf';
import { RenderEngine, createBlock } from '../src/index';
import { fontConfig, save } from './shared';

/** 1x1 PNG โปร่งใส — ใช้แทนโลโก้จริงเพื่อโชว์ addImage() + auto-scale ลง contentWidth */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const paragraph =
  'ข้อความตัวอย่างสำหรับทดสอบการตัดบรรทัดอัตโนมัติ (word wrap) ของ PdfCursor engine เมื่อความกว้างไม่พอสำหรับหนึ่งบรรทัด engine จะคำนวณจำนวนบรรทัดจริงผ่าน jsPDF splitTextToSize แล้วเลื่อน cursor ลงตามความสูงที่วัดได้ ';

const doc = new jsPDF();
const engine = new RenderEngine(doc, { font: fontConfig });

engine.render([
  createBlock({
    type: 'text',
    content: 'Text / Spacer / Divider / Image',
    style: { fontSize: 18, fontStyle: 'bold' },
  }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock({
    type: 'text',
    content: 'ข้อความสีเทา fontSize 10 — style override ทับ DEFAULT_TEXT_STYLE',
    style: { fontSize: 10, color: [100, 100, 100] },
  }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({ type: 'divider' }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({
    type: 'image',
    data: TINY_PNG_BASE64,
    format: 'PNG',
    width: 400, // เกิน contentWidth (~180mm) ตั้งใจ → auto-scale ลงคง aspect ratio
    height: 400,
  }),
  createBlock({ type: 'spacer', height: 6 }),
  createBlock({ type: 'text', content: paragraph.repeat(3) }),
  createBlock({ type: 'spacer', height: 10 }),
  createBlock({ type: 'divider', thickness: 1, color: [200, 0, 0] }),
  createBlock({ type: 'spacer', height: 4 }),
  createBlock({
    type: 'text',
    content: 'ทดสอบ auto page-break: บรรทัดซ้ำด้านล่างจะดันเนื้อหาล้นไปหน้าถัดไปเอง',
    style: { fontStyle: 'bold' },
  }),
  ...Array.from({ length: 60 }, (_, i) =>
    createBlock({
      type: 'text',
      content: `บรรทัดทดสอบที่ ${i + 1} — RenderEngine ขึ้นหน้าใหม่เองเมื่อพื้นที่ไม่พอ`,
    }),
  ),
]);

save(doc, '01-text-blocks');
