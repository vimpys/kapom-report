import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { drawText } from '../../src/core/draw-text';
import { KapomFontError } from '../../src/core/errors';
import { containsThai, isBuiltinStandardFont } from '../../src/core/font-guard';
import { registerFonts } from '../../src/font/register-fonts';

const fontsDir = join(__dirname, '../fixtures/fonts');

function docWithSarabun(): jsPDF {
  const doc = new jsPDF();
  const family = registerFonts(doc, {
    fonts: [
      { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Regular.ttf'))), style: 'normal' },
    ],
  });
  doc.setFont(family, 'normal');

  return doc;
}

describe('containsThai', () => {
  it('จับตัวอักษรไทยทุกแบบ (พยัญชนะ/สระ/วรรณยุกต์/เลขไทย)', () => {
    expect(containsThai('รวม')).toBe(true);
    expect(containsThai('เงื่อนไข')).toBe(true);
    expect(containsThai('๑๒๓')).toBe(true);
    expect(containsThai('mixed ไทย text')).toBe(true);
  });

  it('อังกฤษ/ตัวเลข/สัญลักษณ์ล้วน → false', () => {
    expect(containsThai('Total 1,234.50')).toBe(false);
    expect(containsThai('')).toBe(false);
  });
});

describe('isBuiltinStandardFont', () => {
  it('standard 14 ของ jsPDF → true (case-insensitive)', () => {
    expect(isBuiltinStandardFont('helvetica')).toBe(true);
    expect(isBuiltinStandardFont('Helvetica')).toBe(true);
    expect(isBuiltinStandardFont('times')).toBe(true);
    expect(isBuiltinStandardFont('courier')).toBe(true);
  });

  it('font ที่ user ลงทะเบียนเอง → false', () => {
    expect(isBuiltinStandardFont('Sarabun')).toBe(false);
  });
});

describe('Thai font guard × drawText (ค้างแก้ #1 — กัน mojibake เงียบ)', () => {
  it('ข้อความไทย + helvetica (default) → throw KapomFontError พร้อมทางแก้', () => {
    const doc = new jsPDF();
    expect(() => drawText(doc, 'รายงานประจำเดือน', 10, 10)).toThrow(KapomFontError);
    expect(() => drawText(doc, 'รายงานประจำเดือน', 10, 10)).toThrow(/Register a Thai font/);
  });

  it('ข้อความอังกฤษ + helvetica → ผ่านปกติ', () => {
    const doc = new jsPDF();
    expect(() => drawText(doc, 'Monthly Report', 10, 10)).not.toThrow();
  });

  it('ข้อความไทย + Sarabun ที่ลงทะเบียนแล้ว → ผ่านปกติ', () => {
    const doc = docWithSarabun();
    expect(() => drawText(doc, 'รายงานประจำเดือน', 10, 10)).not.toThrow();
  });

  it('array หลายบรรทัด — จับบรรทัดไทยที่ปนอยู่ได้', () => {
    const doc = new jsPDF();
    expect(() => drawText(doc, ['english line', 'บรรทัดไทย'], 10, 10)).toThrow(KapomFontError);
  });
});
