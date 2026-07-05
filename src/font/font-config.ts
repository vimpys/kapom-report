/** jsPDF setFont รับค่าเหล่านี้เป็น fontStyle ตอนวาด (ต่างชุดกับ primitives.FontStyle ที่ไม่มี bolditalic) */
export type FontVariantStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface FontSource {
  family: string;
  /** ข้อมูลไฟล์ font (.ttf) — base64 (ไม่มี data URI prefix) หรือ binary */
  data: string | Uint8Array;
  /** default 'normal' — ต้อง match กับ fontStyle ที่ report เรียกใช้จริงทุกจุด */
  style?: FontVariantStyle;
}

export interface FontConfig {
  /** non-empty tuple — บังคับมีอย่างน้อย 1 ตัวที่ระดับ type, fonts[0] จึง type-safe */
  fonts: readonly [FontSource, ...FontSource[]];
  /** optional → fallback fonts[0].family ถ้าไม่ระบุ (option B, กัน silent helvetica fallback) */
  defaultFamily?: string;
}
