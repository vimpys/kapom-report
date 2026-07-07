import { describe, expect, it } from 'vitest';
import { nativeNumeric } from '../../src/numeric/numeric-strategy';
import { createSegmentState } from '../../src/table/column-resolver';
import {
  buildGroupTree,
  countGroupBands,
  flattenGroupTreeRows,
} from '../../src/table/group-tree';
import type { ReportColumn } from '../../src/types/column';
import type { GroupResolver } from '../../src/types/node';

interface Sale {
  no?: never;
  region: string;
  category: string;
  product: string;
  qty: number;
}

const sales: Sale[] = [
  { region: 'North', category: 'Food', product: 'A', qty: 1 },
  { region: 'North', category: 'Food', product: 'B', qty: 2 },
  { region: 'North', category: 'Drink', product: 'C', qty: 3 },
  { region: 'South', category: 'Food', product: 'D', qty: 4 },
  { region: 'South', category: 'Drink', product: 'E', qty: 5 },
  { region: 'South', category: 'Drink', product: 'F', qty: 6 },
];

const columns: ReportColumn<Sale>[] = [
  { type: 'rowNumber', header: '#' },
  { type: 'data', key: 'product', header: 'Product' },
  { type: 'data', key: 'qty', header: 'Qty', aggregate: 'sum' },
];

const nested: GroupResolver<Sale> = {
  by: 'region',
  subGroup: { by: 'category' },
};

function build(resolver: GroupResolver<Sale> = nested) {
  return buildGroupTree(columns, sales, resolver, nativeNumeric, createSegmentState(columns.length));
}

describe('buildGroupTree — โครงสร้าง 2 ระดับ', () => {
  it('ระดับนอก = region (depth 0), ระดับใน = category (depth 1) ตามลำดับ first-seen', () => {
    const tree = build();

    expect(tree.map((n) => n.label)).toEqual(['North', 'South']);
    expect(tree.every((n) => n.depth === 0)).toBe(true);
    expect(tree[0]?.children?.map((n) => n.label)).toEqual(['Food', 'Drink']);
    expect(tree[1]?.children?.map((n) => n.label)).toEqual(['Food', 'Drink']);
    expect(tree[0]?.children?.every((n) => n.depth === 1)).toBe(true);
  });

  it('non-leaf ไม่มี body, leaf มี body และไม่มี children', () => {
    const tree = build();

    for (const region of tree) {
      expect(region.body).toBeUndefined();
      expect(region.children).toBeDefined();
      for (const category of region.children ?? []) {
        expect(category.children).toBeUndefined();
        expect(category.body).toBeDefined();
      }
    }
  });

  it('foot (subtotal) มีทุกระดับเมื่อ column มี aggregate — ยอดถูกต้องต่อกลุ่ม', () => {
    const tree = build();

    // North ทั้งกลุ่ม = 1+2+3 = 6, North>Food = 1+2 = 3 (qty ไม่มี numberFormat → ไม่บังคับทศนิยม)
    expect(tree[0]?.foot?.[2]).toBe('6');
    expect(tree[0]?.children?.[0]?.foot?.[2]).toBe('3');
    // South ทั้งกลุ่ม = 4+5+6 = 15, South>Drink = 5+6 = 11
    expect(tree[1]?.foot?.[2]).toBe('15');
    expect(tree[1]?.children?.[1]?.foot?.[2]).toBe('11');
  });

  it('foot เป็น undefined ทุกระดับเมื่อไม่มี column ไหนประกาศ aggregate', () => {
    const noAggregate: ReportColumn<Sale>[] = [{ type: 'data', key: 'product', header: 'Product' }];
    const tree = buildGroupTree(noAggregate, sales, nested, nativeNumeric, createSegmentState(1));

    expect(tree[0]?.foot).toBeUndefined();
    expect(tree[0]?.children?.[0]?.foot).toBeUndefined();
  });

  it('rowNumber continuous นับต่อเนื่องข้าม leaf segment ทุกระดับตามลำดับ render', () => {
    const tree = build();
    const leafBodies = tree.flatMap((region) => region.children ?? []).map((leaf) => leaf.body ?? []);
    const rowNumbers = leafBodies.flat().map((row) => row[0]);

    // North>Food (A,B) → North>Drink (C) → South>Food (D) → South>Drink (E,F)
    expect(rowNumbers).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('headerLabel/footerLabel ของแต่ละระดับใช้ resolver ของระดับตัวเอง', () => {
    const tree = build({
      by: 'region',
      headerLabel: (key) => `ภูมิภาค ${key}`,
      subGroup: { by: 'category', footerLabel: (key) => `ยอด ${key}` },
    });

    expect(tree[0]?.label).toBe('ภูมิภาค North');
    expect(tree[0]?.children?.[0]?.label).toBe('Food'); // ระดับในไม่มี headerLabel → key ตรงๆ
    expect(tree[0]?.children?.[0]?.foot?.[0]).toBe('ยอด Food');
    expect(tree[0]?.foot?.[0]).toBe('Total North'); // ระดับนอกไม่มี footerLabel → default
  });

  it('minRowsWithHeader มาจาก keepTogether ของ resolver ระดับตัวเอง (default 1)', () => {
    const tree = build({
      by: 'region',
      keepTogether: { minRowsWithHeader: 3 },
      subGroup: { by: 'category' },
    });

    expect(tree[0]?.minRowsWithHeader).toBe(3);
    expect(tree[0]?.children?.[0]?.minRowsWithHeader).toBe(1);
  });

  it('ระดับเดียว (ไม่มี subGroup) — ทุก node เป็น leaf เหมือน grouped path เดิม', () => {
    const tree = build({ by: 'region' });

    expect(tree).toHaveLength(2);
    expect(tree.every((n) => n.children === undefined && n.body !== undefined)).toBe(true);
    expect(tree[0]?.body).toHaveLength(3);
    expect(tree[1]?.body).toHaveLength(3);
  });

  it('3 ระดับซ้อน (region → category → product) ได้ depth 0/1/2 ครบ', () => {
    const tree = build({
      by: 'region',
      subGroup: { by: 'category', subGroup: { by: 'product' } },
    });

    const level1 = tree[0]?.children?.[0];
    const level2 = level1?.children?.[0];
    expect(level1?.depth).toBe(1);
    expect(level2?.depth).toBe(2);
    expect(level2?.body).toBeDefined(); // leaf ชั้นในสุดเท่านั้นที่มี body
    expect(level1?.body).toBeUndefined();
  });
});

describe('flattenGroupTreeRows', () => {
  it('รวม body ของ leaf + foot ทุกระดับตามลำดับ render (ใช้คำนวณ column widths)', () => {
    const tree = build();
    const rows = flattenGroupTreeRows(tree);

    // 6 data rows + 4 leaf foots + 2 region foots = 12
    expect(rows).toHaveLength(12);
    // ลำดับ: North>Food body(2) → foot → North>Drink body(1) → foot → foot North → ...
    expect(rows[2]?.[0]).toBe('Total Food');
    expect(rows[5]?.[0]).toBe('Total North');
  });
});

describe('countGroupBands', () => {
  it('นับ band ทุกระดับรวมกัน — 2 region + 4 category = 6', () => {
    expect(countGroupBands(nested, sales)).toBe(6);
  });

  it('ระดับเดียวนับเท่าจำนวนกลุ่ม', () => {
    expect(countGroupBands({ by: 'region' }, sales)).toBe(2);
  });
});
