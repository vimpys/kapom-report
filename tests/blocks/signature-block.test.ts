import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import {
  SignatureBlock,
  DEFAULT_SIGNATURE_SIGN_HEIGHT,
  DEFAULT_SIGNATURE_LABEL_GAP,
  DEFAULT_SIGNATURE_SLOT_GAP,
} from '../../src/blocks/signature-block';
import { DEFAULT_TEXT_STYLE } from '../../src/blocks/text-block';
import { DEFAULT_DIVIDER_COLOR, DEFAULT_DIVIDER_THICKNESS } from '../../src/blocks/divider-block';
import { KapomLayoutError } from '../../src/core/errors';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

describe('SignatureBlock — validation', () => {
  it('slots ว่าง → throw KapomLayoutError ตอนสร้าง', () => {
    expect(() => new SignatureBlock({ type: 'signature', slots: [] })).toThrow(
      KapomLayoutError,
    );
  });

  it('signHeight ติดลบหรือ NaN → throw KapomLayoutError ตอนสร้าง', () => {
    expect(
      () =>
        new SignatureBlock({
          type: 'signature',
          slots: [{ label: 'ผู้จัดทำ' }],
          signHeight: -1,
        }),
    ).toThrow(KapomLayoutError);
    expect(
      () =>
        new SignatureBlock({
          type: 'signature',
          slots: [{ label: 'ผู้จัดทำ' }],
          signHeight: Number.NaN,
        }),
    ).toThrow(KapomLayoutError);
  });
});

describe('SignatureBlock — measureHeight', () => {
  it('ใช้ default signHeight/labelGap + max label height ข้าม slot (1 บรรทัด)', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new SignatureBlock({
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำ' }, { label: 'ผู้อนุมัติ' }],
    });

    const height = block.measureHeight(engine.createMeasureContext());
    const singleLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;

    expect(height).toBeCloseTo(
      DEFAULT_SIGNATURE_SIGN_HEIGHT + DEFAULT_SIGNATURE_LABEL_GAP + singleLineHeight,
      6,
    );
  });

  it('label หลายบรรทัด → ความสูงคิดจากจำนวนบรรทัดที่มากสุด', () => {
    const { doc } = makeStubDoc(['line1', 'line2']);
    const engine = new RenderEngine(doc);
    const block = new SignatureBlock({
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำรายงานประจำเดือน' }],
    });

    const height = block.measureHeight(engine.createMeasureContext());
    const singleLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;

    expect(height).toBeCloseTo(
      DEFAULT_SIGNATURE_SIGN_HEIGHT + DEFAULT_SIGNATURE_LABEL_GAP + 2 * singleLineHeight,
      6,
    );
  });
});

describe('SignatureBlock — render', () => {
  it('วาดเส้นแบ่ง contentWidth เท่ากันตามจำนวน slot', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new SignatureBlock({
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำ' }, { label: 'ผู้อนุมัติ' }],
    });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    const columnWidth = (180 - DEFAULT_SIGNATURE_SLOT_GAP) / 2;
    const lineY = 15 + DEFAULT_SIGNATURE_SIGN_HEIGHT;

    expect(stub.setDrawColor).toHaveBeenCalledWith(...DEFAULT_DIVIDER_COLOR);
    expect(stub.setLineWidth).toHaveBeenCalledWith(DEFAULT_DIVIDER_THICKNESS);
    expect(stub.line).toHaveBeenNthCalledWith(1, 15, lineY, 15 + columnWidth, lineY);
    expect(stub.line).toHaveBeenNthCalledWith(
      2,
      15 + columnWidth + DEFAULT_SIGNATURE_SLOT_GAP,
      lineY,
      15 + columnWidth + DEFAULT_SIGNATURE_SLOT_GAP + columnWidth,
      lineY,
    );
  });

  it('วาด label กึ่งกลางใต้เส้นแต่ละ slot', () => {
    const { stub, doc } = makeStubDoc(['ผู้จัดทำ']);
    // label ไทย + stub font default เป็น helvetica → ต้องตั้ง font ไม่ใช่ built-in ก่อน (Thai font guard)
    doc.setFont('Sarabun', 'normal');
    const engine = new RenderEngine(doc);
    const block = new SignatureBlock({
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำ' }],
    });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    const columnWidth = 180;
    const lineY = 15 + DEFAULT_SIGNATURE_SIGN_HEIGHT;
    const singleLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    const textWidth = 'ผู้จัดทำ'.length * 2; // stub getTextWidth: length*2
    const expectedX = 15 + (columnWidth - textWidth) / 2;
    const expectedY = lineY + DEFAULT_SIGNATURE_LABEL_GAP + singleLineHeight;

    expect(stub.text).toHaveBeenCalledWith('ผู้จัดทำ', expectedX, expectedY);
  });

  it('advance cursor y ตาม signHeight + labelGap + label lines', () => {
    const { doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new SignatureBlock({
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำ' }],
    });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    const singleLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(ctx.cursor.y).toBeCloseTo(
      15 + DEFAULT_SIGNATURE_SIGN_HEIGHT + DEFAULT_SIGNATURE_LABEL_GAP + singleLineHeight,
      6,
    );
  });

  it('รับ signHeight/labelGap/slotGap/style override', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new SignatureBlock({
      type: 'signature',
      slots: [{ label: 'ผู้จัดทำ' }],
      signHeight: 25,
      labelGap: 5,
      slotGap: 20,
      style: { fontSize: 14, color: [200, 0, 0] },
    });

    block.render(engine.createRenderContext());

    expect(stub.setFontSize).toHaveBeenCalledWith(14);
    expect(stub.setTextColor).toHaveBeenCalledWith(200, 0, 0);
    expect(stub.line).toHaveBeenCalledWith(15, 15 + 25, 15 + 180, 15 + 25);
  });
});
