import { describe, expect, it } from 'vitest';
import {
  groupFooterLabel,
  groupHeaderLabel,
  splitGroups,
} from '../../src/table/group-resolver';

interface Row {
  category: string;
  amount: number;
}

const rows: Row[] = [
  { category: 'B', amount: 1 },
  { category: 'A', amount: 2 },
  { category: 'B', amount: 3 },
  { category: 'A', amount: 4 },
];

describe('splitGroups', () => {
  it('แบ่งตาม key คงลำดับตามที่ key ปรากฏครั้งแรก', () => {
    const groups = splitGroups(rows, { by: 'category' });

    expect(groups.map((g) => g.key)).toEqual(['B', 'A']);
    expect(groups[0]?.rows.map((r) => r.amount)).toEqual([1, 3]);
    expect(groups[1]?.rows.map((r) => r.amount)).toEqual([2, 4]);
  });

  it('แบ่งด้วย fn', () => {
    const groups = splitGroups(rows, {
      by: (row) => (row.amount % 2 === 0 ? 'even' : 'odd'),
    });

    expect(groups.map((g) => g.key)).toEqual(['odd', 'even']);
  });

  it('sortGroups override ลำดับ', () => {
    const groups = splitGroups(rows, {
      by: 'category',
      sortGroups: (a, b) => a.localeCompare(b),
    });

    expect(groups.map((g) => g.key)).toEqual(['A', 'B']);
  });

  it('data ว่าง → ไม่มีกลุ่ม', () => {
    expect(splitGroups([], { by: 'category' })).toEqual([]);
  });
});

describe('group labels', () => {
  it('default: header = key, footer = "รวม key"', () => {
    const resolver = { by: 'category' as const };
    expect(groupHeaderLabel<Row>(resolver, 'A', [])).toBe('A');
    expect(groupFooterLabel<Row>(resolver, 'A', [])).toBe('รวม A');
  });

  it('custom labels รับ key + rows', () => {
    const groups = splitGroups(rows, { by: 'category' });
    const resolver = {
      by: 'category' as const,
      headerLabel: (key: string, groupRows: readonly Row[]) =>
        `${key} (${groupRows.length} รายการ)`,
      footerLabel: (key: string) => `ยอดรวม ${key}`,
    };

    const first = groups[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(groupHeaderLabel(resolver, first.key, first.rows)).toBe('B (2 รายการ)');
    expect(groupFooterLabel(resolver, first.key, first.rows)).toBe('ยอดรวม B');
  });
});
