import { describe, expect, it } from 'vitest';
import { KapomFontError } from '../../src/core/errors';
import type { FontConfig } from '../../src/font/font-config';
import { registerFonts } from '../../src/font/register-fonts';
import { makeStubDoc } from '../helpers/stub-doc';

const VALID_BASE64 = 'aGVsbG8='; // 'hello'

describe('registerFonts — VFS registration', () => {
  it('ลงทะเบียนทุก font ผ่าน addFileToVFS + addFont ตามลำดับ', () => {
    const { stub, doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: VALID_BASE64 }],
    };

    registerFonts(doc, config);

    expect(stub.addFileToVFS).toHaveBeenCalledWith('Sarabun-normal.ttf', VALID_BASE64);
    expect(stub.addFont).toHaveBeenCalledWith('Sarabun-normal.ttf', 'Sarabun', 'normal');
  });

  it('ลงทะเบียนหลาย style ของ family เดียวกัน — คนละ VFS filename', () => {
    const { stub, doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [
        { family: 'Sarabun', data: VALID_BASE64, style: 'normal' },
        { family: 'Sarabun', data: VALID_BASE64, style: 'bold' },
      ],
    };

    registerFonts(doc, config);

    expect(stub.addFileToVFS).toHaveBeenNthCalledWith(1, 'Sarabun-normal.ttf', VALID_BASE64);
    expect(stub.addFileToVFS).toHaveBeenNthCalledWith(2, 'Sarabun-bold.ttf', VALID_BASE64);
    expect(stub.addFont).toHaveBeenNthCalledWith(1, 'Sarabun-normal.ttf', 'Sarabun', 'normal');
    expect(stub.addFont).toHaveBeenNthCalledWith(2, 'Sarabun-bold.ttf', 'Sarabun', 'bold');
  });

  it('รับ Uint8Array แล้วแปลงเป็น base64 ก่อนส่งเข้า addFileToVFS', () => {
    const { stub, doc } = makeStubDoc();
    const bytes = new TextEncoder().encode('hello'); // 'hello' -> aGVsbG8=
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: bytes }],
    };

    registerFonts(doc, config);

    expect(stub.addFileToVFS).toHaveBeenCalledWith('Sarabun-normal.ttf', VALID_BASE64);
  });

  it('คืน defaultFamily ที่ระบุ', () => {
    const { doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: VALID_BASE64 }, { family: 'Roboto', data: VALID_BASE64 }],
      defaultFamily: 'Roboto',
    };

    expect(registerFonts(doc, config)).toBe('Roboto');
  });

  it('ไม่ระบุ defaultFamily → fallback fonts[0].family (option B)', () => {
    const { doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: VALID_BASE64 }, { family: 'Roboto', data: VALID_BASE64 }],
    };

    expect(registerFonts(doc, config)).toBe('Sarabun');
  });
});

describe('registerFonts — fail-fast validation', () => {
  it('defaultFamily ไม่มีใน fonts ที่ลงทะเบียน → throw KapomFontError', () => {
    const { doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: VALID_BASE64 }],
      defaultFamily: 'NotRegistered',
    };

    expect(() => registerFonts(doc, config)).toThrow(KapomFontError);
  });

  it('family ว่าง → throw', () => {
    const { doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: '  ', data: VALID_BASE64 }],
    };

    expect(() => registerFonts(doc, config)).toThrow(KapomFontError);
  });

  it('base64 ไม่ valid (มี data URI prefix หลงเหลือ) → throw', () => {
    const { doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: 'data:font/ttf;base64,aGVsbG8=' }],
    };

    expect(() => registerFonts(doc, config)).toThrow(KapomFontError);
  });

  it('base64 มีอักขระนอกชุดที่ถูกต้อง → throw', () => {
    const { doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [{ family: 'Sarabun', data: 'not valid base64!!' }],
    };

    expect(() => registerFonts(doc, config)).toThrow(KapomFontError);
  });

  it('ไม่ลงทะเบียน VFS เลยเมื่อ validation fail (fail-fast ก่อนลงมือ)', () => {
    const { stub, doc } = makeStubDoc();
    const config: FontConfig = {
      fonts: [
        { family: 'Sarabun', data: VALID_BASE64 },
        { family: 'Bad', data: 'invalid!!' },
      ],
    };

    expect(() => registerFonts(doc, config)).toThrow(KapomFontError);
    expect(stub.addFileToVFS).not.toHaveBeenCalled();
  });
});
