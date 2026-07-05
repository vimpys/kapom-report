import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { RenderEngine } from '../../src/core/engine';
import type { TableNode } from '../../src/types/node';
import { DEFAULT_TYPOGRAPHY } from '../../src/types/typography';

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
      group: { by: 'region', subGroup: { by: 'category' } },
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
      createBlock({ ...nestedNode(data), group: { by: 'region' } } satisfies TableNode<RegionSale>),
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

    const node = nestedNode(makeRegionSales(8));
    engine.render([
      createBlock({
        ...node,
        group: { by: 'region', subGroup: { by: 'category', subGroup: { by: 'product' } } },
      } satisfies TableNode<RegionSale>),
    ]);

    expect(doc.lastAutoTable?.finalY).toBeDefined();
  });
});
