/**
 * บังคับใช้ทุก text ก่อนถึง jsPDF (decision ใน CLAUDE.md) — jsPDF คำนวณ width
 * แบบ glyph-by-glyph ตรงๆ ตัวควบคุม/whitespace แปลกๆ ทำ layout พัง (width เพี้ยน,
 * ตัดบรรทัดผิดที่, หรือวาดเป็นสี่เหลี่ยม) โดยไม่มี error ให้เห็น
 */
export interface TextNormalizeOptions {
  /** NBSP (U+00A0, U+202F) -> space ปกติ; ปิดได้ถ้าตั้งใจใช้กันตัวเลขตัด — default true */
  collapseNbsp?: boolean;
  /** จำนวน space แทนหนึ่ง tab (jsPDF ไม่รู้จัก tab stop) — default 4 */
  tabWidth?: number;
}

// สร้างผ่าน RegExp(string) ไม่ใช่ literal ตรงๆ — กัน editor/encoding แปลง \u escape
// เป็น unicode char จริงในไฟล์ source (zero-width/bidi ไม่ควรอยู่เป็นตัวอักษรจริงในโค้ด)
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\u2060]', 'g');
const BIDI_MARKS = new RegExp('[\\u200E\\u200F\\u202A-\\u202E]', 'g');
const BOM = new RegExp('[\\uFEFF]', 'g');
const CONTROL_CHARS_EXCEPT_NEWLINE = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F]', 'g');
const NBSP = new RegExp('[\\u00A0\\u202F]', 'g');

/**
 * Thai combining marks (สระ/วรรณยุกต์) ไม่ strip — ต้องพึ่ง font shaping ที่ถูกต้อง
 * (เชื่อมกับ font registry ใน ../font) ไม่ใช่ปัญหาที่ normalizer แก้ได้
 */
export function normalizeText(text: string, options: TextNormalizeOptions = {}): string {
  const tabWidth = options.tabWidth ?? 4;
  const collapseNbsp = options.collapseNbsp ?? true;

  let result = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' '.repeat(tabWidth))
    .replace(ZERO_WIDTH, '')
    .replace(BIDI_MARKS, '')
    .replace(BOM, '')
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, '');

  if (collapseNbsp) {
    result = result.replace(NBSP, ' ');
  }

  return result;
}
