import { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { describe, expect, it, vi } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { TableNode } from '../../src/types/node';
import { DEFAULT_TYPOGRAPHY } from '../../src/types/typography';

// ESM module namespaces aren't configurable, so vi.spyOn can't wrap a named export directly —
// vi.mock + importOriginal lets us call through to the real implementation while still recording calls
const autoTableCalls: UserOptions[] = [];
vi.mock('jspdf-autotable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf-autotable')>();
  return {
    ...actual,
    autoTable: (doc: jsPDF, options: UserOptions) => {
      autoTableCalls.push(options);
      return actual.autoTable(doc, options);
    },
  };
});

interface Sale {
  no?: never;
  product: string;
  qty: number;
  price: string;
}

function makeSales(count: number): Sale[] {
  return Array.from({ length: count }, (_, i) => ({
    product: `Product ${i + 1}`,
    qty: (i % 5) + 1,
    price: `${(i % 100) + 1}.25`,
  }));
}

function tableNode(data: Sale[]): TableNode<Sale> {
  return {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right' },
      { type: 'data', key: 'product', header: 'Product' },
      { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { type: 'data', key: 'price', header: 'Price', align: 'right', numberFormat: {}, aggregate: 'sum' },
    ],
    data,
    summaryLabel: 'Total',
  };
}

describe('TableBlock × jsPDF + AutoTable จริง', () => {
  it('ตารางสั้น: วาดจบหน้าเดียว, cursor sync ไป finalY', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(tableNode(makeSales(5)))]);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.lastAutoTable?.finalY).toBeDefined();
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
    expect(ctx.cursor.y).toBeGreaterThan(15); // เลื่อนลงจาก margin top จริง
    expect(ctx.cursor.pageIndex).toBe(0);
  });

  it('ตารางยาว: AutoTable แบ่งหน้าเอง → cursor.pageIndex ตามหน้าสุดท้ายจริง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(tableNode(makeSales(200)))]);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(ctx.cursor.pageIndex).toBe(doc.getNumberOfPages() - 1);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
  });

  it('block ถัดจากตารางเริ่มวาดต่อจาก finalY บนหน้าสุดท้าย ไม่ทับตาราง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    const recorded: Array<{ y: number; pageIndex: number }> = [];
    engine.render([
      createBlock(tableNode(makeSales(60))),
      {
        measureHeight: () => 10,
        render: (c) => {
          recorded.push({ y: c.cursor.y, pageIndex: c.cursor.pageIndex });
          c.advanceY(10);
        },
      },
    ]);

    const tableEndPage = doc.getNumberOfPages() - 1;
    expect(recorded).toHaveLength(1);
    const after = recorded[0];
    expect(after).toBeDefined();
    // block ถัดไปต้องอยู่หน้าเดียวกับ (หรือถัดจาก) จุดจบตาราง และไม่อยู่เหนือ finalY
    expect(after?.pageIndex).toBeGreaterThanOrEqual(tableEndPage);
    expect(ctx.cursor.pageIndex).toBeGreaterThanOrEqual(tableEndPage);
  });

  it('ตารางสองตัวต่อกัน: ตัวที่สอง startY ต่อจากตัวแรก', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(tableNode(makeSales(3)))]);
    const firstEnd = ctx.cursor.y;

    engine.render([createBlock(tableNode(makeSales(3)))]);

    expect(ctx.cursor.y).toBeGreaterThan(firstEnd);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

interface CategorizedSale extends Sale {
  category: string;
}

function groupedNode(
  data: CategorizedSale[],
  keepTogether?: { minRowsWithHeader: number },
): TableNode<CategorizedSale> {
  return {
    type: 'table',
    columns: [
      { type: 'rowNumber', header: '#', align: 'right', mode: 'per-group' },
      { type: 'data', key: 'product', header: 'Product' },
      { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      { type: 'data', key: 'price', header: 'Price', align: 'right', numberFormat: {}, aggregate: 'sum' },
    ],
    data,
    summaryLabel: 'Grand Total',
    group: {
      by: 'category',
      headerLabel: (key, rows) => `${key} — ${rows.length} items`,
      footerLabel: (key) => `Subtotal ${key}`,
      ...(keepTogether ? { keepTogether } : {}),
    },
  };
}

function makeCategorized(perGroup: number, categories: string[]): CategorizedSale[] {
  return categories.flatMap((category) =>
    makeSales(perGroup).map((s) => ({ ...s, category })),
  );
}

describe('TableBlock (grouped) × jsPDF + AutoTable จริง', () => {
  it('หลายกลุ่ม + grand total: render จบ cursor sync ถูกต้อง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(groupedNode(makeCategorized(4, ['Alpha', 'Beta', 'Gamma'])))]);

    expect(doc.getNumberOfPages()).toBe(1);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
    expect(ctx.cursor.pageIndex).toBe(0);
  });

  it('grand total: fillColor เป็นสีที่ตั้งใจจริง ไม่ถูกทับด้วย theme default alternateRow', () => {
    // 'striped' (default theme) ตั้ง alternateRow.fillColor ให้ body row index คู่ — grand total
    // เป็น body แถวเดียวเสมอ (index 0 = คู่เสมอ) จึงชนปัญหานี้ 100% ถ้าไม่ตั้ง theme: 'plain'
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(groupedNode(makeCategorized(2, ['Alpha', 'Beta'])))]);

    const grandTotalTable = doc.lastAutoTable;
    expect(grandTotalTable?.body[0]?.cells['0']?.styles.fillColor).toEqual([41, 128, 185]);
  });

  it('กลุ่มใหญ่ข้ามหลายหน้า → cursor ตามหน้าสุดท้าย', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(groupedNode(makeCategorized(60, ['Alpha', 'Beta'])))]);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(ctx.cursor.pageIndex).toBe(doc.getNumberOfPages() - 1);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
  });

  it('keep-together: กลุ่มที่เริ่มใกล้ท้ายหน้า → break ไปเริ่มหน้าใหม่ทั้งก้อน (band ไม่ orphan)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    // ดัน cursor ไปใกล้ท้ายหน้า (เหลือ ~10mm — ไม่พอ band+head+3 แถว)
    const contentBottom = 297 - 15;
    engine.render([
      { measureHeight: () => 0, render: (c) => c.advanceY(contentBottom - 15 - 10) },
      createBlock(groupedNode(makeCategorized(5, ['Alpha']), { minRowsWithHeader: 3 })),
    ]);

    expect(doc.getNumberOfPages()).toBe(2);
    // กลุ่มทั้งก้อน (band+ตาราง) อยู่หน้า 2 → จบไม่ไกลจากหัวหน้า
    expect(ctx.cursor.pageIndex).toBe(1);
    expect(ctx.cursor.y).toBeLessThan(100);
  });

  it('block ถัดไปหลัง grouped table ต่อจาก grand total ไม่ทับ', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    const recorded: number[] = [];
    engine.render([
      createBlock(groupedNode(makeCategorized(3, ['Alpha', 'Beta']))),
      {
        measureHeight: () => 5,
        render: (c) => {
          recorded.push(c.cursor.y);
          c.advanceY(5);
        },
      },
    ]);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toBe(doc.lastAutoTable?.finalY);
    expect(ctx.cursor.y).toBeGreaterThan(recorded[0] ?? Number.POSITIVE_INFINITY);
  });
});

interface Ledger {
  label: string;
  amount: number;
}

function ledgerNode(data: Ledger[], overrides: Partial<TableNode<Ledger>> = {}): TableNode<Ledger> {
  return {
    type: 'table',
    columns: [
      { type: 'data', key: 'label', header: 'Label' },
      { type: 'data', key: 'amount', header: 'Amount', align: 'right' },
    ],
    data,
    summaryLabel: 'Total',
    ...overrides,
  };
}

describe('TableBlock — Typography tokens × jsPDF จริง', () => {
  it('head/body/foot ใช้ fontSize/color จาก Typography token ที่ resolve แล้ว', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode(
          [{ label: 'a', amount: 1 }],
          { columns: [
            { type: 'data', key: 'label', header: 'Label' },
            { type: 'data', key: 'amount', header: 'Amount', align: 'right', aggregate: 'sum' },
          ] },
        ),
      ),
    ]);

    const headCell = doc.lastAutoTable?.head[0]?.cells['0'];
    const bodyCell = doc.lastAutoTable?.body[0]?.cells['0'];
    const footCell = doc.lastAutoTable?.foot[0]?.cells['0'];

    expect(headCell?.styles.fontSize).toBe(DEFAULT_TYPOGRAPHY.columnHeader.fontSize);
    expect(headCell?.styles.textColor).toEqual([...(DEFAULT_TYPOGRAPHY.columnHeader.color ?? [])]);
    expect(bodyCell?.styles.fontSize).toBe(DEFAULT_TYPOGRAPHY.detailRow.fontSize);
    expect(footCell?.styles.fontSize).toBe(DEFAULT_TYPOGRAPHY.summary.fontSize);
  });

  it('typography override เปลี่ยน fontSize ของ columnHeader จริง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc, { typography: { columnHeader: { fontSize: 16 } } });

    engine.render([createBlock(ledgerNode([{ label: 'a', amount: 1 }]))]);

    expect(doc.lastAutoTable?.head[0]?.cells['0']?.styles.fontSize).toBe(16);
    // token อื่นไม่ได้ override ยังเป็น default
    expect(doc.lastAutoTable?.body[0]?.cells['0']?.styles.fontSize).toBe(
      DEFAULT_TYPOGRAPHY.detailRow.fontSize,
    );
  });

  it('style.header override fillColor/textColor ของ head จริง (แทน AutoTable theme default)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode([{ label: 'a', amount: 1 }], {
          style: { header: { fillColor: [106, 158, 120], textColor: [255, 255, 255] } },
        }),
      ),
    ]);

    const headCell = doc.lastAutoTable?.head[0]?.cells['0'];
    expect(headCell?.styles.fillColor).toEqual([106, 158, 120]);
    expect(headCell?.styles.textColor).toEqual([255, 255, 255]);
    // body ไม่โดนกระทบ — header เป็น head-section เท่านั้น
    expect(doc.lastAutoTable?.body[0]?.cells['0']?.styles.fillColor).not.toEqual([106, 158, 120]);
  });

  it('style.header ไม่ตั้ง → head ยังใช้ token + theme default เดิม (backward compatible)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(ledgerNode([{ label: 'a', amount: 1 }]))]);

    const headCell = doc.lastAutoTable?.head[0]?.cells['0'];
    expect(headCell?.styles.fontSize).toBe(DEFAULT_TYPOGRAPHY.columnHeader.fontSize);
    expect(headCell?.styles.textColor).toEqual([...(DEFAULT_TYPOGRAPHY.columnHeader.color ?? [])]);
  });

  it('style.footer override fillColor ของ foot จริง (symmetric กับ header, ไม่กระทบ body)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode([{ label: 'a', amount: 1 }], {
          columns: [
            { type: 'data', key: 'label', header: 'Label' },
            { type: 'data', key: 'amount', header: 'Amount', align: 'right', aggregate: 'sum' },
          ],
          style: { footer: { fillColor: [199, 108, 142] } },
        }),
      ),
    ]);

    expect(doc.lastAutoTable?.foot[0]?.cells['1']?.styles.fillColor).toEqual([199, 108, 142]);
    // body ไม่โดนกระทบ — footer เป็น foot-section เท่านั้น
    expect(doc.lastAutoTable?.body[0]?.cells['1']?.styles.fillColor).not.toEqual([199, 108, 142]);
  });
});

describe('TableBlock — zebra/conditional (Style resolver) × jsPDF จริง', () => {
  const rows: Ledger[] = [
    { label: 'a', amount: 10 },
    { label: 'b', amount: -5 },
    { label: 'c', amount: 20 },
  ];

  it('zebra: แถวคู่/คี่ได้สี fillColor สลับกันตาม rowIndex', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode(rows, {
          style: { zebra: { even: [255, 255, 255], odd: [240, 240, 240] } },
        }),
      ),
    ]);

    const body = doc.lastAutoTable?.body ?? [];
    expect(body[0]?.cells['0']?.styles.fillColor).toEqual([255, 255, 255]);
    expect(body[1]?.cells['0']?.styles.fillColor).toEqual([240, 240, 240]);
    expect(body[2]?.cells['0']?.styles.fillColor).toEqual([255, 255, 255]);
  });

  it('conditional: ยอดติดลบ = สีแดง ไม่กระทบแถวอื่น', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode(rows, {
          style: {
            conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
          },
        }),
      ),
    ]);

    const body = doc.lastAutoTable?.body ?? [];
    expect(body[1]?.cells['0']?.styles.textColor).toEqual([220, 38, 38]);
    expect(body[0]?.cells['0']?.styles.textColor).not.toEqual([220, 38, 38]);
  });

  it('precedence: conditional ทับ zebra บนแถวที่เงื่อนไขตรง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode(rows, {
          style: {
            zebra: { even: [255, 255, 255], odd: [240, 240, 240] },
            conditional: (row) => (row.amount < 0 ? { fillColor: [220, 38, 38] } : undefined),
          },
        }),
      ),
    ]);

    const body = doc.lastAutoTable?.body ?? [];
    // แถว index 1 (คี่ → zebra ควรได้ [240,240,240]) แต่ conditional ทับเป็นแดง
    expect(body[1]?.cells['0']?.styles.fillColor).toEqual([220, 38, 38]);
    // แถวอื่นยังเป็น zebra ปกติ
    expect(body[0]?.cells['0']?.styles.fillColor).toEqual([255, 255, 255]);
  });

  it('grouped table: zebra/conditional ใช้ rows ของกลุ่มนั้นๆ ไม่ปนข้ามกลุ่ม', () => {
    interface CategorizedLedger extends Ledger {
      category: string;
    }
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const data: CategorizedLedger[] = [
      { category: 'A', label: 'a1', amount: 5 },
      { category: 'A', label: 'a2', amount: -5 },
      { category: 'B', label: 'b1', amount: -1 },
      { category: 'B', label: 'b2', amount: 1 },
    ];

    engine.render([
      createBlock({
        type: 'table',
        columns: [
          { type: 'data', key: 'label', header: 'Label' },
          { type: 'data', key: 'amount', header: 'Amount', align: 'right' },
        ],
        data,
        group: { by: 'category' },
        style: {
          conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
        },
      }),
    ]);

    // ไม่มี aggregate → ไม่มี grand total table → lastAutoTable คือ segment สุดท้าย (category 'B')
    // rowIndex เป็น local ต่อ segment (0-based ในกลุ่มนั้น) ไม่ใช่ index รวมทั้ง data
    const body = doc.lastAutoTable?.body ?? [];
    expect(body[0]?.cells['0']?.styles.textColor).toEqual([220, 38, 38]); // b1: amount -1
    expect(body[1]?.cells['0']?.styles.textColor).not.toEqual([220, 38, 38]); // b2: amount 1
  });
});

describe('TableBlock — column-level headerStyle/cellStyle × jsPDF จริง', () => {
  it('headerStyle ใช้กับ head cell ของคอลัมน์นั้นเท่านั้น ไม่กระทบคอลัมน์อื่น', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode([{ label: 'a', amount: 1 }], {
          columns: [
            { type: 'data', key: 'label', header: 'Label', headerStyle: { fontSize: 16, color: [255, 0, 0] } },
            { type: 'data', key: 'amount', header: 'Amount', align: 'right' },
          ],
        }),
      ),
    ]);

    const head = doc.lastAutoTable?.head[0]?.cells ?? {};
    expect(head['0']?.styles.fontSize).toBe(16);
    expect(head['0']?.styles.textColor).toEqual([255, 0, 0]);
    // คอลัมน์ที่ไม่ได้ตั้ง headerStyle ยังใช้ Typography columnHeader token ปกติ
    expect(head['1']?.styles.fontSize).toBe(DEFAULT_TYPOGRAPHY.columnHeader.fontSize);
  });

  it('cellStyle ใช้กับทุก body cell ของคอลัมน์นั้น ไม่กระทบ head', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode(
          [
            { label: 'a', amount: 1 },
            { label: 'b', amount: 2 },
          ],
          {
            columns: [
              { type: 'data', key: 'label', header: 'Label' },
              {
                type: 'data',
                key: 'amount',
                header: 'Amount',
                align: 'right',
                cellStyle: { fontStyle: 'italic', color: [0, 100, 0] },
              },
            ],
          },
        ),
      ),
    ]);

    const body = doc.lastAutoTable?.body ?? [];
    expect(body[0]?.cells['1']?.styles.fontStyle).toBe('italic');
    expect(body[0]?.cells['1']?.styles.textColor).toEqual([0, 100, 0]);
    expect(body[1]?.cells['1']?.styles.textColor).toEqual([0, 100, 0]);
    // head ของคอลัมน์เดียวกันไม่ได้รับ cellStyle
    expect(doc.lastAutoTable?.head[0]?.cells['1']?.styles.fontStyle).not.toBe('italic');
    // คอลัมน์อื่นไม่ได้รับผลกระทบ
    expect(body[0]?.cells['0']?.styles.textColor).not.toEqual([0, 100, 0]);
  });

  it('precedence: zebra/conditional (row-level) ยังทับ cellStyle (column-level) ได้', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(
        ledgerNode(
          [
            { label: 'a', amount: 5 },
            { label: 'b', amount: -5 },
          ],
          {
            columns: [
              { type: 'data', key: 'label', header: 'Label' },
              {
                type: 'data',
                key: 'amount',
                header: 'Amount',
                align: 'right',
                cellStyle: { color: [0, 0, 0] },
              },
            ],
            style: {
              conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
            },
          },
        ),
      ),
    ]);

    const body = doc.lastAutoTable?.body ?? [];
    // แถว 0: conditional ไม่ตรง → cellStyle (ดำ) ยังอยู่
    expect(body[0]?.cells['1']?.styles.textColor).toEqual([0, 0, 0]);
    // แถว 1: conditional ตรง → ทับ cellStyle เป็นแดง
    expect(body[1]?.cells['1']?.styles.textColor).toEqual([220, 38, 38]);
  });
});

describe('TableBlock × nested group (subGroup chain, roadmap 10)', () => {
  interface RegionSale {
    no?: never;
    region: string;
    category: string;
    product: string;
    qty: number;
  }

  function makeRegionSales(count: number): RegionSale[] {
    return Array.from({ length: count }, (_, i) => ({
      region: i % 2 === 0 ? 'North' : 'South',
      category: i % 3 === 0 ? 'Food' : 'Drink',
      product: `Product ${i + 1}`,
      qty: (i % 5) + 1,
    }));
  }

  function nestedNode(data: RegionSale[]): TableNode<RegionSale> {
    return {
      type: 'table',
      columns: [
        { type: 'rowNumber', header: '#', align: 'right' },
        { type: 'data', key: 'product', header: 'Product' },
        { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      ],
      data,
      // footerLabel default เป็นภาษาไทย — เทสต์ชุดนี้ไม่ลงทะเบียนฟอนต์ไทย ต้อง override (Thai font guard)
      group: {
        by: 'region',
        footerLabel: (key) => `Sum ${key}`,
        subGroup: { by: 'category', footerLabel: (key) => `Sum ${key}` },
      },
      summaryLabel: 'Grand Total',
    };
  }

  it('2 ระดับ: วาดจบไม่ throw, cursor sync ตาม doc, grand total เป็นตารางสุดท้าย', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(nestedNode(makeRegionSales(12)))]);

    expect(doc.lastAutoTable?.finalY).toBeDefined();
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY);
    // grand total = body แถวเดียว theme plain (ตารางสุดท้ายที่วาด)
    expect(doc.lastAutoTable?.body).toHaveLength(1);
  });

  it('nested กินความสูงมากกว่า single-level เพราะมี band+subtotal ต่อ sub-group เพิ่ม', () => {
    const data = makeRegionSales(12);

    const docNested = new jsPDF();
    const engineNested = new RenderEngine(docNested);
    const ctxNested = engineNested.createRenderContext();
    engineNested.render([createBlock(nestedNode(data))]);

    const docFlat = new jsPDF();
    const engineFlat = new RenderEngine(docFlat);
    const ctxFlat = engineFlat.createRenderContext();
    engineFlat.render([
      createBlock({
        ...nestedNode(data),
        group: { by: 'region', footerLabel: (key) => `Sum ${key}` },
      } satisfies TableNode<RegionSale>),
    ]);

    const nestedTotal = ctxNested.cursor.pageIndex * 1000 + ctxNested.cursor.y;
    const flatTotal = ctxFlat.cursor.pageIndex * 1000 + ctxFlat.cursor.y;
    expect(nestedTotal).toBeGreaterThan(flatTotal);
  });

  it('ตารางยาวข้ามหน้า: AutoTable/keep-together แบ่งหน้าเอง cursor.pageIndex ตามหน้าสุดท้ายจริง', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(nestedNode(makeRegionSales(120)))]);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(ctx.cursor.pageIndex).toBe(doc.getNumberOfPages() - 1);
  });

  it('3 ระดับซ้อน (region → category → product) วาดจบไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const englishFooter = (key: string): string => `Sum ${key}`;
    const node = nestedNode(makeRegionSales(8));
    engine.render([
      createBlock({
        ...node,
        group: {
          by: 'region',
          footerLabel: englishFooter,
          subGroup: {
            by: 'category',
            footerLabel: englishFooter,
            subGroup: { by: 'product', footerLabel: englishFooter },
          },
        },
      } satisfies TableNode<RegionSale>),
    ]);

    expect(doc.lastAutoTable?.finalY).toBeDefined();
  });
});

describe('TableBlock × No-Data fallback (data ว่าง — ค้างแก้ #5)', () => {
  function emptyNode(overrides: Partial<TableNode<Sale>> = {}): TableNode<Sale> {
    return {
      type: 'table',
      columns: [
        { type: 'data', key: 'product', header: 'Product' },
        { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
      ],
      data: [],
      summaryLabel: 'Total',
      noDataText: 'No data', // matches DEFAULT_NO_DATA_TEXT — explicit here so the assertion doesn't depend on the default staying this value
      ...overrides,
    };
  }

  it('flat + data ว่าง → หัวตาราง + แถวข้อความเดียว colSpan (ไม่ใช่หัวเปล่าเงียบๆ แล้ว)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);
    const ctx = engine.createRenderContext();

    engine.render([createBlock(emptyNode())]);

    const body = doc.lastAutoTable?.body ?? [];
    expect(body).toHaveLength(1);
    expect(body[0]?.cells['0']?.text.join('')).toBe('No data');
    expect(body[0]?.cells['0']?.colSpan).toBe(2);
    expect(ctx.cursor.y).toBe(doc.lastAutoTable?.finalY); // cursor sync ปกติ
  });

  it('grouped + data ว่าง → fallback เดียวกัน (ไม่มี band/subtotal/grand total)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([
      createBlock(emptyNode({ group: { by: 'product', footerLabel: (k) => `Sum ${k}` } })),
    ]);

    const body = doc.lastAutoTable?.body ?? [];
    expect(body).toHaveLength(1);
    expect(body[0]?.cells['0']?.text.join('')).toBe('No data');
  });

  it('noDataText default (English, zero-config) ไม่ลงทะเบียนฟอนต์ไทย → ไม่ throw', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    const node = emptyNode();
    delete node.noDataText;
    engine.render([createBlock(node)]);

    const body = doc.lastAutoTable?.body ?? [];
    expect(body[0]?.cells['0']?.text.join('')).toBe('No data');
  });
});

describe('TableBlock × aggregate row label colSpan (aesthetics fix — merges the label into empty leading columns)', () => {
  it('flat table: rowNumber + no-aggregate Product column → summary label spans both, left-aligned', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(tableNode(makeSales(3)))]);

    const footCell = doc.lastAutoTable?.foot[0]?.cells['0'];
    expect(footCell?.colSpan).toBe(2);
    expect(footCell?.text.join('')).toBe('Total');
    expect(footCell?.styles.halign).toBe('left');
    // the numeric columns after the merge keep their own (right) alignment, untouched
    expect(doc.lastAutoTable?.foot[0]?.cells['2']?.styles.halign).toBe('right');
  });

  it('grouped table: leaf segment foot label spans the empty columns the same way', () => {
    // doc.lastAutoTable only reflects the LAST autoTable() call (the grand total table, which
    // has no `foot` at all) — inspect the recorded calls to find the leaf segment's own options
    autoTableCalls.length = 0;
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(groupedNode(makeCategorized(2, ['Alpha'])))]);

    const leafOptions = autoTableCalls[0];
    const footRow = leafOptions?.foot?.[0] as [{ content: string; colSpan: number; styles: { halign: string } }];
    expect(footRow[0]).toEqual({ content: 'Subtotal Alpha', colSpan: 2, styles: { halign: 'left' } });
  });

  it('grand total (body row): label spans the empty columns and stays left-aligned', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(groupedNode(makeCategorized(2, ['Alpha', 'Beta'])))]);

    // grand total is the last AutoTable call — a single body row, theme 'plain'
    const bodyCell = doc.lastAutoTable?.body[0]?.cells['0'];
    expect(bodyCell?.colSpan).toBe(2);
    expect(bodyCell?.text.join('')).toBe('Grand Total');
    expect(bodyCell?.styles.halign).toBe('left');
  });

  it('single cell with no aggregate remaining after the label (span=1) → stays a plain cell, not colSpan', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    // only the rowNumber column is empty — Product itself carries no aggregate but IS the
    // very next column and has no aggregate either, so this scenario instead checks a column
    // layout where the label's neighbor already has a value: Product carries an aggregate here.
    engine.render([
      createBlock({
        type: 'table',
        columns: [
          { type: 'rowNumber', header: '#', align: 'right' },
          {
            type: 'data',
            key: 'product',
            header: 'Product',
            aggregate: () => 'n/a',
          },
          { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
        ],
        data: makeSales(3).map(({ product, qty }) => ({ product, qty, price: '0' })),
        summaryLabel: 'Total',
      } satisfies TableNode<Sale>),
    ]);

    const footCell = doc.lastAutoTable?.foot[0]?.cells['0'];
    expect(footCell?.colSpan).toBe(1);
    expect(footCell?.text.join('')).toBe('Total');
  });
});

describe('TableBlock × rowNumber mode per-page × jsPDF จริง', () => {
  function perPageNode(data: Sale[]): TableNode<Sale> {
    return {
      type: 'table',
      columns: [
        { type: 'rowNumber', header: '#', align: 'right', mode: 'per-page' },
        { type: 'data', key: 'product', header: 'Product' },
      ],
      data,
    };
  }

  it('เลขแถวรีเซ็ตเป็น 1 ทุกครั้งที่ขึ้นหน้าใหม่จริง — willDrawCell hook เดียว ไม่ต้อง two-pass', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(perPageNode(makeSales(80)))]);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);

    const body = doc.lastAutoTable?.body ?? [];
    const numbers = body.map((row) => Number(row.cells['0']?.text.join('')));

    expect(numbers[0]).toBe(1);
    // continuous numbering across 80 rows would never repeat or go down — a real per-page reset
    // must show up as the sequence dropping back down somewhere
    const hasReset = numbers.some((n, i) => i > 0 && n <= (numbers[i - 1] ?? 0));
    expect(hasReset).toBe(true);
  });

  it('head row ไม่ถูกแตะ (hook เช็ค section === body เท่านั้น)', () => {
    const doc = new jsPDF();
    const engine = new RenderEngine(doc);

    engine.render([createBlock(perPageNode(makeSales(3)))]);

    expect(doc.lastAutoTable?.head[0]?.cells['0']?.text.join('')).toBe('#');
  });
});
