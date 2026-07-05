import type { jsPDF } from 'jspdf';
import { KapomFontError } from '../core/errors';
import type { FontConfig, FontSource } from './font-config';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function isValidBase64(value: string): boolean {
  return value.length > 0 && value.length % 4 === 0 && BASE64_PATTERN.test(value);
}

/** jsPDF btoa/atob เป็น global ทั้งใน browser และ Node >=18 — ไม่ผูกกับ Buffer ให้ lib รันได้ทั้งสองฝั่ง */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK_SIZE = 0x8000; // กัน call stack overflow กับ font ไฟล์ใหญ่
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function toBase64(data: FontSource['data']): string {
  return typeof data === 'string' ? data : uint8ArrayToBase64(data);
}

/** VFS filename ต้อง unique ต่อ family+style กัน overwrite กันเวลามีหลาย weight ของ family เดียวกัน */
function vfsFilename(font: FontSource): string {
  return `${font.family}-${font.style ?? 'normal'}.ttf`;
}

function validateFontConfig(config: FontConfig): void {
  if (config.fonts.length === 0) {
    throw new KapomFontError('FontConfig.fonts ต้องมีอย่างน้อย 1 ตัว');
  }

  const families = new Set(config.fonts.map((font) => font.family));

  if (config.defaultFamily !== undefined && !families.has(config.defaultFamily)) {
    throw new KapomFontError(
      `FontConfig.defaultFamily '${config.defaultFamily}' ไม่มีใน fonts ที่ลงทะเบียน (${[...families].join(', ')})`,
    );
  }

  for (const font of config.fonts) {
    if (font.family.trim() === '') {
      throw new KapomFontError('FontSource.family ห้ามเป็นค่าว่าง');
    }
    if (typeof font.data === 'string' && !isValidBase64(font.data)) {
      throw new KapomFontError(
        `FontSource '${font.family}': data ไม่ใช่ base64 ที่ถูกต้อง (เช็ค data URI prefix ที่หลงเหลืออยู่ไหม)`,
      );
    }
  }
}

/**
 * ลงทะเบียน font เข้า VFS ของ doc — ต้องเรียกก่อน block แรก render (VFS timing)
 * คืน default font family ที่ resolve แล้ว (defaultFamily หรือ fallback fonts[0])
 */
export function registerFonts(doc: jsPDF, config: FontConfig): string {
  validateFontConfig(config);

  for (const font of config.fonts) {
    const filename = vfsFilename(font);
    doc.addFileToVFS(filename, toBase64(font.data));
    doc.addFont(filename, font.family, font.style ?? 'normal');
  }

  return config.defaultFamily ?? config.fonts[0].family;
}
