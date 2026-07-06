/**
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * โฟกัส: style override, word-wrap อัตโนมัติ, auto page-break, image auto-scale
 * + text shorthand: string ตรงๆ หรือ object ไม่ใส่ type = text node (ไม่ต้องพิมพ์ type: 'text')
 * เรียกผ่าน createKapomReport({ blocks }) — ไม่ต้องแตะ jsPDF/RenderEngine เอง
 */
import { createKapomReport } from '../src/index';
import type { ReportNodeInput } from '../src/index';
import { fontConfig, saveReport } from './shared';

/** 1x1 PNG โปร่งใส — ใช้แทนโลโก้จริงเพื่อโชว์ addImage() + auto-scale ลง contentWidth */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const paragraph =
  'ข้อความตัวอย่างสำหรับทดสอบการตัดบรรทัดอัตโนมัติ (word wrap) ของ PdfCursor engine เมื่อความกว้างไม่พอสำหรับหนึ่งบรรทัด engine จะคำนวณจำนวนบรรทัดจริงผ่าน jsPDF splitTextToSize แล้วเลื่อน cursor ลงตามความสูงที่วัดได้ ';

const blocks: ReportNodeInput[] = [
  // text shorthand: object ไม่ใส่ type = text node
  { content: 'Text / Spacer / Divider / Image', style: { fontSize: 18, fontStyle: 'bold' } },
  { type: 'spacer', height: 4 },
  {
    content: 'ข้อความสีเทา fontSize 10 — style override ทับ DEFAULT_TEXT_STYLE',
    style: { fontSize: 10, color: [100, 100, 100] },
  },
  { type: 'spacer', height: 6 },
  { type: 'divider' },
  { type: 'spacer', height: 6 },
  {
    type: 'image',
    data: TINY_PNG_BASE64,
    format: 'PNG',
    width: 400, // เกิน contentWidth (~180mm) ตั้งใจ → auto-scale ลงคง aspect ratio
    height: 400,
  },
  { type: 'spacer', height: 6 },
  paragraph.repeat(3), // text shorthand: string ตรงๆ = text node
  { type: 'spacer', height: 10 },
  { type: 'divider', thickness: 1, color: [200, 0, 0] },
  { type: 'spacer', height: 4 },
  {
    content: 'ทดสอบ auto page-break: บรรทัดซ้ำด้านล่างจะดันเนื้อหาล้นไปหน้าถัดไปเอง',
    style: { fontStyle: 'bold' },
  },
  ...Array.from(
    { length: 60 },
    (_, i) => `บรรทัดทดสอบที่ ${i + 1} — RenderEngine ขึ้นหน้าใหม่เองเมื่อพื้นที่ไม่พอ`,
  ),
];

saveReport(createKapomReport({ blocks, font: fontConfig }), '01-text-blocks');
