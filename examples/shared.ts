/**
 * ตัวช่วยที่ทุก demo ใช้ร่วมกัน — โหลดฟอนต์ไทย + เขียนไฟล์ออก
 * แต่ละ demo เป็นไฟล์ standalone รันตรงได้ (`tsx examples/01-text-blocks.ts`)
 * หรือรันทั้งหมดผ่าน `npm run demo`
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FontConfig, KapomReport } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '../tests/fixtures/fonts');
const outDir = join(here, 'output');

/** Sarabun (Google Fonts, OFL) — ฟอนต์ไทยสำหรับทุก demo; ลงทะเบียนต่อ engine (VFS ต่อ doc) */
export const fontConfig: FontConfig = {
  fonts: [
    { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Regular.ttf'))), style: 'normal' },
    { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Bold.ttf'))), style: 'bold' },
  ],
};

/** เขียน PDF ลง examples/output/<name>.pdf แล้ว log จำนวนหน้า — รับ KapomReport จาก createKapomReport() */
export function saveReport(report: KapomReport, name: string): void {
  mkdirSync(outDir, { recursive: true });
  report.save(join(outDir, `${name}.pdf`));
  console.log(`✓ ${name}.pdf (${report.doc.getNumberOfPages()} หน้า)`);
}
