import { describe, expect, it } from 'vitest';
import { createAnchoredBand } from '../../src/core/anchor';
import { drawText } from '../../src/core/draw-text';
import { KapomError } from '../../src/core/errors';
import type { PageBandContext } from '../../src/core/page-band';
import { makeStubDoc } from '../helpers/stub-doc';

function makeCtx(stubDoc: ReturnType<typeof makeStubDoc>, overrides?: Partial<PageBandContext>): PageBandContext {
  const { doc } = stubDoc;

  return {
    doc,
    pageIndex: 0,
    pageCount: 3,
    x: 10,
    y: 280,
    width: 190,
    height: 10,
    drawText: (text, x, y) => drawText(doc, text, x, y),
    ...overrides,
  };
}

describe('createAnchoredBand', () => {
  it('align ซ้ำในหนึ่ง band → throw KapomError ตอนสร้าง', () => {
    expect(() =>
      createAnchoredBand({
        height: 10,
        anchors: [
          { align: 'left', format: 'a' },
          { align: 'left', format: 'b' },
        ],
      }),
    ).toThrow(KapomError);
  });

  it('align ไม่ซ้ำ → สร้างได้ปกติ', () => {
    expect(() =>
      createAnchoredBand({
        height: 10,
        anchors: [
          { align: 'left', format: 'a' },
          { align: 'right', format: 'b' },
        ],
      }),
    ).not.toThrow();
  });

  it('คืน PageBand ที่มี height ตรงตาม options', () => {
    const band = createAnchoredBand({ height: 12, anchors: [{ align: 'left', format: 'x' }] });
    expect(band.height).toBe(12);
  });

  it('showOnFirstPage ส่งต่อไปยัง PageBand', () => {
    const band = createAnchoredBand({
      height: 10,
      anchors: [{ align: 'left', format: 'x' }],
      showOnFirstPage: false,
    });
    expect(band.showOnFirstPage).toBe(false);
  });

  it('แทน {pageNumber}/{totalPages} เป็น 1-based จาก pageIndex', () => {
    const stubDoc = makeStubDoc();
    // format เป็นภาษาไทย — ต้องตั้ง font ที่ไม่ใช่ built-in ก่อน ไม่งั้นโดน Thai font guard (fail-fast ที่ถูกต้อง)
    stubDoc.doc.setFont('Sarabun', 'normal');
    const band = createAnchoredBand({
      height: 10,
      anchors: [{ align: 'left', format: 'หน้า {pageNumber} จาก {totalPages}' }],
    });

    band.render(makeCtx(stubDoc, { pageIndex: 1, pageCount: 5 }));

    expect(stubDoc.stub.text).toHaveBeenCalledWith('หน้า 2 จาก 5', expect.any(Number), expect.any(Number));
  });

  it('align left → x = ctx.x', () => {
    const stubDoc = makeStubDoc();
    const band = createAnchoredBand({ height: 10, anchors: [{ align: 'left', format: 'L' }] });

    band.render(makeCtx(stubDoc));

    expect(stubDoc.stub.text).toHaveBeenCalledWith('L', 10, expect.any(Number));
  });

  it('align right → x = ctx.x + ctx.width - textWidth', () => {
    const stubDoc = makeStubDoc();
    const band = createAnchoredBand({ height: 10, anchors: [{ align: 'right', format: 'RR' }] });

    band.render(makeCtx(stubDoc));

    // getTextWidth stub: text.length * 2 → 'RR' = 4
    expect(stubDoc.stub.text).toHaveBeenCalledWith('RR', 10 + 190 - 4, expect.any(Number));
  });

  it('align center → x กึ่งกลาง width', () => {
    const stubDoc = makeStubDoc();
    const band = createAnchoredBand({ height: 10, anchors: [{ align: 'center', format: 'CC' }] });

    band.render(makeCtx(stubDoc));

    // 'CC' width = 4 → x = 10 + (190-4)/2
    expect(stubDoc.stub.text).toHaveBeenCalledWith('CC', 10 + (190 - 4) / 2, expect.any(Number));
  });

  it('style override ถูกส่งเข้า setFontSize/setTextColor', () => {
    const stubDoc = makeStubDoc();
    const band = createAnchoredBand({
      height: 10,
      anchors: [{ align: 'left', format: 'S', style: { fontSize: 14, color: [255, 0, 0] } }],
    });

    band.render(makeCtx(stubDoc));

    expect(stubDoc.stub.setFontSize).toHaveBeenCalledWith(14);
    expect(stubDoc.stub.setTextColor).toHaveBeenCalledWith(255, 0, 0);
  });

  it('หลาย anchor วาดครบทุกตัว', () => {
    const stubDoc = makeStubDoc();
    const band = createAnchoredBand({
      height: 10,
      anchors: [
        { align: 'left', format: 'A' },
        { align: 'center', format: 'B' },
        { align: 'right', format: 'C' },
      ],
    });

    band.render(makeCtx(stubDoc));

    expect(stubDoc.stub.text).toHaveBeenCalledTimes(3);
  });

  it('dateFormat option ส่งต่อไป resolveSystemFields', () => {
    const stubDoc = makeStubDoc();
    const band = createAnchoredBand({
      height: 10,
      anchors: [{ align: 'left', format: '{date}' }],
      dateFormat: { locale: 'en-US', dateStyle: 'long' },
      now: () => new Date(Date.UTC(2026, 6, 5)),
    });

    band.render(makeCtx(stubDoc));

    expect(stubDoc.stub.text).toHaveBeenCalledWith('July 5, 2026', expect.any(Number), expect.any(Number));
  });
});
