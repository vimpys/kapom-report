import { existsSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { KapomError } from '../../src/core/errors';
import { assertNodeIoSupported, isNodeRuntime, TEMP_PDF_MAX_AGE_MS, writeTempPdf } from '../../src/report/node-io';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // '%PDF'
const created: string[] = [];

function makeTempPdf(name: string, ageMs: number): string {
  const file = join(tmpdir(), name);
  writeFileSync(file, PDF_BYTES);
  const past = new Date(Date.now() - ageMs);
  utimesSync(file, past, past);
  created.push(file);
  return file;
}

afterEach(() => {
  for (const file of created.splice(0)) rmSync(file, { force: true });
});

describe('node-io', () => {
  it('isNodeRuntime บน vitest (Node จริง) → true', () => {
    expect(isNodeRuntime()).toBe(true);
  });

  it('writeTempPdf เขียนไฟล์จริงตาม pattern แล้วคืน path', () => {
    const file = writeTempPdf(PDF_BYTES);
    created.push(file);

    expect(existsSync(file)).toBe(true);
    expect(file).toMatch(/kapom-report-\d+\.pdf$/);
  });

  it('เคลียร์ temp file เก่ากว่า TEMP_PDF_MAX_AGE_MS ตอนเรียกครั้งใหม่ (ค้างแก้ #7)', () => {
    const oldFile = makeTempPdf('kapom-report-1000.pdf', TEMP_PDF_MAX_AGE_MS + 60_000);
    const recentFile = makeTempPdf('kapom-report-2000.pdf', 1_000);

    const newFile = writeTempPdf(PDF_BYTES);
    created.push(newFile);

    expect(existsSync(oldFile)).toBe(false); // แก่เกิน → โดนเคลียร์
    expect(existsSync(recentFile)).toBe(true); // ยังใหม่ (viewer อาจเปิดอยู่) → เก็บไว้
    expect(existsSync(newFile)).toBe(true);
  });

  it('ไม่แตะไฟล์อื่นใน tmpdir ที่ไม่ตรง pattern ของเรา แม้จะเก่า', () => {
    const foreign = makeTempPdf('other-app-report.pdf', TEMP_PDF_MAX_AGE_MS * 2);

    const newFile = writeTempPdf(PDF_BYTES);
    created.push(newFile);

    expect(existsSync(foreign)).toBe(true);
  });
});

describe('assertNodeIoSupported — Node < 22.3 guard', () => {
  it('Node จริง (>= 22.3, มี getBuiltinModule) → ไม่ throw', () => {
    expect(() => assertNodeIoSupported('save')).not.toThrow();
  });

  it('จำลอง Node เก่า (ไม่มี getBuiltinModule) → throw KapomError ข้อความชัด พร้อมชื่อ op', () => {
    const original = process.getBuiltinModule;
    try {
      // simulate Node < 22.3: still a Node process (process.versions.node), but no builtin loader
      (process as unknown as { getBuiltinModule?: unknown }).getBuiltinModule = undefined;

      expect(() => assertNodeIoSupported('preview')).toThrow(KapomError);
      expect(() => assertNodeIoSupported('preview')).toThrow(/preview\(\) needs process\.getBuiltinModule/);
      expect(() => assertNodeIoSupported('save')).toThrow(/save\(\) needs process\.getBuiltinModule/);
    } finally {
      (process as unknown as { getBuiltinModule?: unknown }).getBuiltinModule = original;
    }
  });
});
