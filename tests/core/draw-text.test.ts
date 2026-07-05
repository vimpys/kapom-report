import { describe, expect, it } from 'vitest';
import { drawText } from '../../src/core/draw-text';
import { makeStubDoc } from '../helpers/stub-doc';

// String.fromCharCode ไม่ใช่ paste ตรง — กันตัวอักษรมองไม่เห็นหายระหว่างพิมพ์/บันทึกไฟล์
const ZWSP = String.fromCharCode(0x200b);
const NBSP = String.fromCharCode(0x00a0);

describe('drawText — facade บังคับ normalize ก่อนถึง doc.text()', () => {
  it('string เดี่ยว: normalize แล้วส่งต่อ doc.text()', () => {
    const { stub, doc } = makeStubDoc();

    drawText(doc, `a${ZWSP}b\tc`, 10, 20);

    expect(stub.text).toHaveBeenCalledWith('ab    c', 10, 20);
  });

  it('array ของบรรทัด: normalize ทีละบรรทัด', () => {
    const { stub, doc } = makeStubDoc();

    drawText(doc, [`a${ZWSP}b`, 'c\td'], 5, 8);

    expect(stub.text).toHaveBeenCalledWith(['ab', 'c    d'], 5, 8);
  });

  it('ส่งต่อ options ไปยัง normalizeText (เช่น collapseNbsp: false)', () => {
    const { stub, doc } = makeStubDoc();

    drawText(doc, `a${NBSP}b`, 0, 0, { collapseNbsp: false });

    expect(stub.text).toHaveBeenCalledWith(`a${NBSP}b`, 0, 0);
  });
});
