import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import { KapomError } from '../../src/core/errors';
import type { BlockBand } from '../../src/core/page-band';
import { resolveReportConfig } from '../../src/report/resolve-report-config';
import type { ReportNodeInput } from '../../src/types/node';
import { makeStubDoc, SCALE_FACTOR } from '../helpers/stub-doc';

/** build a resolved BlockBand from declarative children, the way the facade does */
function blockBand(children: ReportNodeInput<unknown>[], height: number): BlockBand {
  return { height, blocks: children.map((c) => createBlock(c)) };
}

describe('BlockBand (declarative page band) — engine finalize', () => {
  it('render block tree ของ header ลงทุกหน้า (ไม่ต้องมี render callback)', () => {
    const { stub, doc } = makeStubDoc(['HEADER']);
    const engine = new RenderEngine(doc, {
      pageHeader: blockBand([{ type: 'text', content: 'HEADER' }], 16),
    });

    // ดันเนื้อหาให้ล้นเป็น 2 หน้า
    engine.render([
      createBlock({ type: 'spacer', height: 250 }),
      createBlock({ type: 'spacer', height: 250 }),
    ]);
    stub.text.mock.calls.length = 0; // เคลียร์ก่อน finalize เพื่อดูเฉพาะ band
    engine.finalize();

    // header วาดครบทั้ง 2 หน้า (stub เริ่ม 1 หน้า + spacer ทำให้ ensureSpace เพิ่มหน้า)
    const headerCalls = stub.text.mock.calls.filter((c) => {
      const arg = c[0];

      return arg === 'HEADER' || (Array.isArray(arg) && arg.includes('HEADER'));
    });
    expect(headerCalls.length).toBe(doc.getNumberOfPages());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('header band วาดที่ขอบบน margin (y เริ่มที่ margins.top)', () => {
    const { stub, doc } = makeStubDoc(['HEADER']);
    const engine = new RenderEngine(doc, {
      margins: { top: 20, bottom: 15, left: 15, right: 15 },
      pageHeader: blockBand([{ type: 'text', content: 'HEADER' }], 16),
    });
    engine.render([createBlock({ type: 'text', content: 'body' })]);
    stub.text.mock.calls.length = 0;
    engine.finalize();

    // TextBlock วาด baseline = cursor.y + lineHeight; band top = margins.top = 20
    const headerCall = stub.text.mock.calls.find((c) => {
      const arg = c[0];

      return arg === 'HEADER' || (Array.isArray(arg) && arg.includes('HEADER'));
    });
    expect(headerCall?.[1]).toBe(15); // x = margins.left
    expect(headerCall?.[2] as number).toBeGreaterThan(20); // baseline below band top 20
  });

  it('block band หัก content area เท่า height (เหมือน callback band)', () => {
    const { doc } = makeStubDoc(['x']);
    const withBand = new RenderEngine(doc, {
      pageHeader: blockBand([{ type: 'text', content: 'H' }], 30),
    });
    const ctx = withBand.createRenderContext();
    // contentTop ถูกดันลงมาเท่า header height (margins.top 15 + 30)
    expect(ctx.contentTop).toBe(45);
  });

  it('auto-height: band ไม่ระบุ height → engine วัดจาก block เอง แล้วหัก content area เท่าที่วัดได้', () => {
    const { doc } = makeStubDoc(['line1', 'line2']); // แต่ละ text = 2 บรรทัด
    // band ไม่มี height (auto) — 1 text block สูง 2 บรรทัด
    const band = { blocks: [createBlock({ type: 'text', content: 'H' })] };
    const engine = new RenderEngine(doc, { pageHeader: band });
    const ctx = engine.createRenderContext();

    const lineHeight = (10 * 1.15) / SCALE_FACTOR; // default text fontSize 10
    // contentTop = margins.top (15) + measured band height (2 บรรทัด)
    expect(ctx.contentTop).toBeCloseTo(15 + 2 * lineHeight, 6);
  });
});

describe('BlockBand — facade resolution', () => {
  it('pageHeader ที่มี children ถูก resolve เป็น BlockBand (blocks) ไม่ใช่ callback', () => {
    const resolved = resolveReportConfig({
      blocks: [{ type: 'text', content: 'body' }],
      pageHeader: {
        height: 20,
        children: [{ type: 'text', content: 'Company' }, { type: 'divider' }],
      },
    });
    const header = resolved.engineOptions.pageHeader;
    expect(header).toBeDefined();
    expect(header && 'blocks' in header).toBe(true);
  });

  it('pageHeader ที่เป็น render callback (PageBand) ผ่านตรงไม่แปลง', () => {
    const resolved = resolveReportConfig({
      blocks: [{ type: 'text', content: 'body' }],
      pageHeader: { height: 12, render: () => undefined },
    });
    const header = resolved.engineOptions.pageHeader;
    expect(header && 'render' in header).toBe(true);
  });

  it('table ใน band children → throw KapomError (confined zone ห้าม block ที่ paginate เอง)', () => {
    expect(() =>
      resolveReportConfig({
        blocks: [{ type: 'text', content: 'body' }],
        pageHeader: {
          height: 20,
          children: [{ type: 'table', columns: [], data: [] }],
        },
      }),
    ).toThrow(KapomError);
  });
});
