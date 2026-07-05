import { describe, expect, it } from 'vitest';
import { resolveReportConfig } from '../../src/report/resolve-report-config';
import type { TableNode, TextNode } from '../../src/types/node';

interface Sale {
  product: string;
  qty: number;
  category: string;
}

const data: Sale[] = [
  { product: 'A', qty: 1, category: 'Food' },
  { product: 'B', qty: 2, category: 'Drink' },
];

describe('resolveReportConfig — column shorthand', () => {
  it('{ key, header } ไม่มี type → normalize เป็น DataColumn', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.columns[0]).toEqual({ key: 'product', header: 'Product', type: 'data' });
  });

  it('column เต็มรูป (มี type) ผ่านตรงไม่ถูกแตะ', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ type: 'rowNumber', header: '#' }],
      data,
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.columns[0]).toEqual({ type: 'rowNumber', header: '#' });
  });

  it('ผสม shorthand กับ full ในชุดเดียวกันได้', () => {
    const { blocks } = resolveReportConfig({
      columns: [
        { type: 'rowNumber', header: '#' },
        { key: 'qty', header: 'Qty', align: 'right' },
      ],
      data,
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.columns).toEqual([
      { type: 'rowNumber', header: '#' },
      { key: 'qty', header: 'Qty', align: 'right', type: 'data' },
    ]);
  });
});

describe('resolveReportConfig — group shorthand', () => {
  it('string key → GroupResolver.by ตรงๆ', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      group: 'category',
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.group).toEqual({ by: 'category' });
  });

  it('GroupResolver เต็มรูปผ่านตรงไม่ถูกแตะ', () => {
    const fullGroup = { by: (row: Sale) => row.category, headerLabel: () => 'x' };
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      group: fullGroup,
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.group).toBe(fullGroup);
  });

  it('ไม่ระบุ group → TableNode.group เป็น undefined (ไม่ set field เปล่าๆ)', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    const table = blocks[0] as TableNode<Sale>;
    expect('group' in table).toBe(false);
  });

  it('array ของ key → nested GroupResolver chain เรียงนอก→ใน (roadmap 10)', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      group: ['category', 'product'],
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.group).toEqual({ by: 'category', subGroup: { by: 'product' } });
  });

  it('array key เดียว → GroupResolver ธรรมดาไม่มี subGroup', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      group: ['category'],
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.group).toEqual({ by: 'category' });
  });

  it('array ว่าง → throw KapomError (fail-fast)', () => {
    expect(() =>
      resolveReportConfig({
        columns: [{ key: 'product', header: 'Product' }],
        data,
        group: [],
      }),
    ).toThrow(/อย่างน้อย 1/);
  });
});

describe('resolveReportConfig — title / blocks composition', () => {
  it('ไม่มี title → blocks มีแค่ table เดียว', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('table');
  });

  it('มี title → text(reportTitle) + spacer + table ตามลำดับ', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      title: 'Monthly Report',
    });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'text', content: 'Monthly Report', role: 'reportTitle' } satisfies TextNode);
    expect(blocks[1]).toEqual({ type: 'spacer', height: 6 });
    expect(blocks[2]?.type).toBe('table');
  });
});

describe('resolveReportConfig — style/summaryLabel pass-through', () => {
  it('style ผ่านตรงเข้า TableNode.style', () => {
    const style = { zebra: { even: [240, 240, 240] as const } };
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      style,
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.style).toBe(style);
  });

  it('summaryLabel ผ่านตรงเข้า TableNode.summaryLabel', () => {
    const { blocks } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      summaryLabel: 'ยอดรวม',
    });

    const table = blocks[0] as TableNode<Sale>;
    expect(table.summaryLabel).toBe('ยอดรวม');
  });
});

describe('resolveReportConfig — document (jsPDF constructor options) pass-through', () => {
  it('ไม่ระบุ document → documentOptions เป็น undefined', () => {
    const { documentOptions } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    expect(documentOptions).toBeUndefined();
  });

  it('ระบุ document (orientation/format/unit) → ผ่านตรงไม่ถูกแตะ', () => {
    const document = { orientation: 'landscape' as const, format: 'letter', unit: 'pt' as const };
    const { documentOptions } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      document,
    });

    expect(documentOptions).toBe(document);
  });
});

describe('resolveReportConfig — blocks variant (ชั้น 3 เต็มรูป)', () => {
  it('blocks ผ่านตรงไม่ถูกแตะ (reference เดิม) ไม่ประกอบ title/table ให้', () => {
    const blocks = [
      { type: 'text', content: 'hi' },
      { type: 'signature', slots: [{ label: 'ผู้จัดทำ' }] },
    ] as const;
    const resolved = resolveReportConfig({ blocks });

    expect(resolved.blocks).toBe(blocks);
  });

  it('engine options + document ใช้ได้กับ blocks variant เหมือน config ปกติ', () => {
    const margins = { top: 25 };
    const document = { orientation: 'landscape' as const };
    const resolved = resolveReportConfig({
      blocks: [{ type: 'text', content: 'hi' }],
      margins,
      document,
    });

    expect(resolved.engineOptions.margins).toBe(margins);
    expect(resolved.documentOptions).toBe(document);
  });
});

describe('resolveReportConfig — engineOptions pass-through', () => {
  it('ไม่ระบุ option ใดเลย → engineOptions เป็น object เปล่า', () => {
    const { engineOptions } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
    });

    expect(engineOptions).toEqual({});
  });

  it('margins/numeric/font/typography/pageHeader/pageFooter/watermark ผ่านตรง', () => {
    const margins = { top: 20 };
    const pageHeader = { height: 10, render: () => {} };
    const { engineOptions } = resolveReportConfig({
      columns: [{ key: 'product', header: 'Product' }],
      data,
      margins,
      pageHeader,
    });

    expect(engineOptions.margins).toBe(margins);
    expect(engineOptions.pageHeader).toBe(pageHeader);
    expect(engineOptions.numeric).toBeUndefined();
  });
});
