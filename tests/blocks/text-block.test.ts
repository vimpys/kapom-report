import { describe, expect, it } from 'vitest';
import { RenderEngine } from '../../src/core/engine';
import { TextBlock, DEFAULT_TEXT_STYLE } from '../../src/blocks/text-block';
import { DEFAULT_TYPOGRAPHY } from '../../src/types/typography';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

describe('TextBlock — measureHeight', () => {
  it('ใช้ default fontSize เมื่อไม่ระบุ style', () => {
    const { stub, doc } = makeStubDoc(['line1', 'line2']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello' });

    const height = block.measureHeight(engine.createMeasureContext());

    expect(stub.setFontSize).toHaveBeenCalledWith(DEFAULT_TEXT_STYLE.fontSize);
    const expectedLineHeight =
      (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(height).toBeCloseTo(2 * expectedLineHeight, 6);
  });

  it('ใช้ fontSize จาก style override', () => {
    const { stub, doc } = makeStubDoc(['only-one-line']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({
      type: 'text',
      content: 'hello',
      style: { fontSize: 20 },
    });

    block.measureHeight(engine.createMeasureContext());

    expect(stub.setFontSize).toHaveBeenCalledWith(20);
  });
});

describe('TextBlock — render', () => {
  it('set fontSize/font/color ตาม default แล้ววาด text ที่ตำแหน่ง cursor', () => {
    const { stub, doc } = makeStubDoc(['line1', 'line2']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello' });

    block.render(engine.createRenderContext());

    expect(stub.setFontSize).toHaveBeenCalledWith(DEFAULT_TEXT_STYLE.fontSize);
    expect(stub.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    expect(stub.setTextColor).toHaveBeenCalledWith(0, 0, 0);

    const expectedLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(stub.text).toHaveBeenCalledWith(
      ['line1', 'line2'],
      15,
      15 + expectedLineHeight,
    );
  });

  it('advance cursor y ตามจำนวนบรรทัด × line-height', () => {
    const { doc } = makeStubDoc(['line1', 'line2', 'line3']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello' });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    const expectedLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(ctx.cursor.y).toBeCloseTo(15 + 3 * expectedLineHeight, 6);
  });

  it('style override: fontSize/fontStyle/fontFamily/color ทั้งหมดถูกส่งเข้า doc', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({
      type: 'text',
      content: 'สวัสดี',
      style: { fontSize: 14, fontStyle: 'bold', fontFamily: 'THSarabun', color: [255, 0, 0] },
    });

    block.render(engine.createRenderContext());

    expect(stub.setFontSize).toHaveBeenCalledWith(14);
    expect(stub.setFont).toHaveBeenCalledWith('THSarabun', 'bold');
    expect(stub.setTextColor).toHaveBeenCalledWith(255, 0, 0);
  });

  it('role ใช้ Typography token เป็น base style แทน DEFAULT_TEXT_STYLE', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'Report Title', role: 'reportTitle' });

    block.render(engine.createRenderContext());

    expect(stub.setFontSize).toHaveBeenCalledWith(DEFAULT_TYPOGRAPHY.reportTitle.fontSize);
    expect(stub.setFont).toHaveBeenCalledWith('helvetica', DEFAULT_TYPOGRAPHY.reportTitle.fontStyle);
  });

  it('align: center — x ต่อบรรทัด = cursor.x + (contentWidth - textWidth)/2', () => {
    // stub getTextWidth = length*2 → 'line1' กว้าง 10; contentWidth 180 → x = 15 + (180-10)/2 = 100
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello', align: 'center' });

    block.render(engine.createRenderContext());

    const expectedLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(stub.text).toHaveBeenCalledWith('line1', 100, 15 + expectedLineHeight);
  });

  it('align: right — x ต่อบรรทัด = cursor.x + contentWidth - textWidth', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello', align: 'right' });

    block.render(engine.createRenderContext());

    const expectedLineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(stub.text).toHaveBeenCalledWith('line1', 15 + 180 - 10, 15 + expectedLineHeight);
  });

  it('align กับหลายบรรทัด — แต่ละบรรทัดคำนวณ x ของตัวเอง + baseline เลื่อนลงทีละ line-height', () => {
    // 'line1' กว้าง 10, 'ab' กว้าง 4 — จุดกึ่งกลางต่างกัน
    const { stub, doc } = makeStubDoc(['line1', 'ab']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello', align: 'center' });

    block.render(engine.createRenderContext());

    const lineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(stub.text).toHaveBeenNthCalledWith(1, 'line1', 100, 15 + lineHeight);
    expect(stub.text).toHaveBeenNthCalledWith(2, 'ab', 15 + (180 - 4) / 2, 15 + 2 * lineHeight);
  });

  it('align ไม่กระทบระยะ advance cursor (ยังเท่าจำนวนบรรทัด × line-height)', () => {
    const { doc } = makeStubDoc(['line1', 'line2']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({ type: 'text', content: 'hello', align: 'right' });
    const ctx = engine.createRenderContext();

    block.render(ctx);

    const lineHeight = (DEFAULT_TEXT_STYLE.fontSize * 1.15) / SCALE_FACTOR;
    expect(ctx.cursor.y).toBeCloseTo(15 + 2 * lineHeight, 6);
  });

  it('style override ทับ role token ทีละ property เท่านั้น', () => {
    const { stub, doc } = makeStubDoc(['line1']);
    const engine = new RenderEngine(doc);
    const block = new TextBlock({
      type: 'text',
      content: 'Report Title',
      role: 'reportTitle',
      style: { color: [255, 0, 0] },
    });

    block.render(engine.createRenderContext());

    // fontSize/fontStyle ยังมาจาก token — override เฉพาะ color
    expect(stub.setFontSize).toHaveBeenCalledWith(DEFAULT_TYPOGRAPHY.reportTitle.fontSize);
    expect(stub.setTextColor).toHaveBeenCalledWith(255, 0, 0);
  });
});
