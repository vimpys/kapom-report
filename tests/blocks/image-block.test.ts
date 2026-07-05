import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { ImageBlock } from '../../src/blocks/image-block';
import { KapomLayoutError } from '../../src/core/errors';
import { makeStubDoc } from '../helpers/stub-doc';

const FAKE_DATA = 'FAKE_BASE64_IMAGE_DATA';

describe('ImageBlock — measureHeight', () => {
  it('width พอดี contentWidth → คืน height ตรงๆ ไม่ scale', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new ImageBlock({
      type: 'image',
      data: FAKE_DATA,
      format: 'PNG',
      width: 100,
      height: 50,
    });

    expect(block.measureHeight(engine.createMeasureContext())).toBe(50);
  });

  it('width เกิน contentWidth (180) → scale height ลงตามอัตราส่วนเดิม', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    // width 360 = 2x ของ contentWidth 180 → height ต้องลดลงครึ่งหนึ่งด้วย
    const block = new ImageBlock({
      type: 'image',
      data: FAKE_DATA,
      format: 'PNG',
      width: 360,
      height: 100,
    });

    expect(block.measureHeight(engine.createMeasureContext())).toBeCloseTo(50, 6);
  });
});

describe('ImageBlock — render', () => {
  it('เรียก doc.addImage ด้วยตำแหน่ง cursor + ขนาดตรงจาก node แล้ว advance y', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new ImageBlock({
      type: 'image',
      data: FAKE_DATA,
      format: 'JPEG',
      width: 100,
      height: 50,
    });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(stub.addImage).toHaveBeenCalledWith(FAKE_DATA, 'JPEG', 15, 15, 100, 50);
    expect(ctx.cursor.y).toBe(15 + 50);
  });

  it('width เกิน contentWidth → addImage ได้ขนาดที่ scale แล้ว ไม่ใช่ค่าดิบจาก node', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const block = new ImageBlock({
      type: 'image',
      data: FAKE_DATA,
      format: 'PNG',
      width: 360,
      height: 100,
    });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    expect(stub.addImage).toHaveBeenCalledWith(FAKE_DATA, 'PNG', 15, 15, 180, 50);
    expect(ctx.cursor.y).toBe(15 + 50);
  });

  it('รับ Uint8Array เป็น data ได้ (ไม่ต้องเป็น base64 string)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const bytes = new Uint8Array([1, 2, 3]);
    const block = new ImageBlock({
      type: 'image',
      data: bytes,
      format: 'PNG',
      width: 10,
      height: 10,
    });

    block.render(engine.createRenderContext());

    expect(stub.addImage).toHaveBeenCalledWith(bytes, 'PNG', 15, 15, 10, 10);
  });
});

describe('ImageBlock — validation', () => {
  it('width <= 0 หรือ NaN → throw KapomLayoutError ตอนสร้าง', () => {
    expect(
      () =>
        new ImageBlock({ type: 'image', data: FAKE_DATA, format: 'PNG', width: 0, height: 10 }),
    ).toThrow(KapomLayoutError);
    expect(
      () =>
        new ImageBlock({
          type: 'image',
          data: FAKE_DATA,
          format: 'PNG',
          width: Number.NaN,
          height: 10,
        }),
    ).toThrow(KapomLayoutError);
  });

  it('height <= 0 หรือ NaN → throw KapomLayoutError ตอนสร้าง', () => {
    expect(
      () =>
        new ImageBlock({ type: 'image', data: FAKE_DATA, format: 'PNG', width: 10, height: 0 }),
    ).toThrow(KapomLayoutError);
    expect(
      () =>
        new ImageBlock({
          type: 'image',
          data: FAKE_DATA,
          format: 'PNG',
          width: 10,
          height: Number.NaN,
        }),
    ).toThrow(KapomLayoutError);
  });
});
