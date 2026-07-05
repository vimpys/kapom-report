import type { jsPDF } from 'jspdf';
import { describe, expect, it, vi } from 'vitest';
import type { MeasurableBlock, RenderContext } from '../src/core/context';
import { RenderEngine } from '../src/core/engine';

// stub เฉพาะ surface ที่ engine แตะ — A4 mm, scaleFactor pt→mm ของ jsPDF
const SCALE_FACTOR = 72 / 25.4;

function makeStubDoc() {
  const stub = {
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      scaleFactor: SCALE_FACTOR,
    },
    addPage: vi.fn(),
    getFontSize: vi.fn(() => 16),
    setFontSize: vi.fn(),
    getLineHeightFactor: vi.fn(() => 1.15),
    splitTextToSize: vi.fn((): string[] => ['line1', 'line2', 'line3']),
  };
  return { stub, doc: stub as unknown as jsPDF };
}

/** block ปลอมสูงคงที่ — บันทึกตำแหน่ง cursor ตอนถูก render */
function makeBlock(height: number) {
  const renderedAt: Array<{ y: number; pageIndex: number }> = [];
  const block: MeasurableBlock = {
    measureHeight: () => height,
    render: (ctx: RenderContext) => {
      renderedAt.push({ y: ctx.cursor.y, pageIndex: ctx.cursor.pageIndex });
      ctx.advanceY(height);
    },
  };
  return { block, renderedAt };
}

describe('RenderEngine — render loop', () => {
  it('วาง block ต่อกันตามลำดับ ไล่ y ลงจาก margin top', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const a = makeBlock(50);
    const b = makeBlock(30);

    engine.render([a.block, b.block]);

    expect(a.renderedAt).toEqual([{ y: 15, pageIndex: 0 }]);
    expect(b.renderedAt).toEqual([{ y: 65, pageIndex: 0 }]);
  });

  it('block ที่ไม่พอพื้นที่ → auto page-break + doc.addPage หนึ่งครั้ง', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    // content height = 297-30 = 267 → ตัวที่สองไม่พอ
    const a = makeBlock(200);
    const b = makeBlock(200);

    engine.render([a.block, b.block]);

    expect(a.renderedAt).toEqual([{ y: 15, pageIndex: 0 }]);
    expect(b.renderedAt).toEqual([{ y: 15, pageIndex: 1 }]);
    expect(stub.addPage).toHaveBeenCalledTimes(1);
  });

  it('block สูงเกินหน้าอยู่ที่หัวหน้าแล้ว → render เลย ไม่ addPage (block break ภายในเอง)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const oversized = makeBlock(500);

    engine.render([oversized.block]);

    expect(oversized.renderedAt).toEqual([{ y: 15, pageIndex: 0 }]);
    expect(stub.addPage).not.toHaveBeenCalled();
  });

  it('custom margins override default', () => {
    const { doc } = makeStubDoc();
    const engine = new RenderEngine(doc, { margins: { top: 30, left: 20 } });
    const a = makeBlock(10);

    engine.render([a.block]);

    expect(a.renderedAt).toEqual([{ y: 30, pageIndex: 0 }]);
    const ctx = engine.createRenderContext();
    expect(ctx.margins).toEqual({ top: 30, bottom: 15, left: 20, right: 15 });
    expect(ctx.contentWidth).toBe(210 - 20 - 15);
  });
});

describe('RenderEngine — MeasureContext.measureText', () => {
  it('คืนความสูง = จำนวนบรรทัด × lineHeight (pt→หน่วย doc ผ่าน scaleFactor)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);
    const ctx = engine.createMeasureContext();

    const height = ctx.measureText('อะไรก็ได้', 10, 180);

    // stub ตัดเป็น 3 บรรทัด: 3 × (10 × 1.15) / scaleFactor
    expect(height).toBeCloseTo((3 * 10 * 1.15) / SCALE_FACTOR, 6);
    expect(stub.splitTextToSize).toHaveBeenCalledWith('อะไรก็ได้', 180);
  });

  it('set fontSize ก่อนวัด แล้ว restore ค่าเดิมเสมอ (measure ห้ามทิ้ง side effect)', () => {
    const { stub, doc } = makeStubDoc();
    const engine = new RenderEngine(doc);

    engine.createMeasureContext().measureText('x', 22, 100);

    expect(stub.setFontSize.mock.calls).toEqual([[22], [16]]);
  });
});
