import { describe, expect, it } from 'vitest';
import { KapomError } from '../../src/core/errors';
import { nativeNumeric } from '../../src/numeric/numeric-strategy';
import {
  DEFAULT_SUMMARY_LABEL,
  resolveTableContent,
} from '../../src/table/column-resolver';
import type { TableNode } from '../../src/types/node';

interface Sale {
  product: string;
  qty: number;
  /** string ตาม DECIMAL จาก DB */
  price: string;
}

const sales: Sale[] = [
  { product: 'Widget A', qty: 2, price: '10.50' },
  { product: 'Widget B', qty: 1, price: '0.10' },
  { product: 'Widget C', qty: 3, price: '0.20' },
];

const baseNode = (columns: TableNode<Sale>['columns']): TableNode<Sale> => ({
  type: 'table',
  columns,
  data: sales,
});

describe('resolveTableContent — head/aligns/widths', () => {
  it('head จาก header, align resolve ตาม headerAlign fallback → align → left', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        { type: 'data', key: 'qty', header: 'จำนวน', align: 'right' },
        { type: 'data', key: 'price', header: 'ราคา', align: 'right', headerAlign: 'center' },
      ]),
      nativeNumeric,
    );

    expect(content.head).toEqual(['สินค้า', 'จำนวน', 'ราคา']);
    expect(content.aligns).toEqual([
      { header: 'left', data: 'left' },
      { header: 'right', data: 'right' },
      { header: 'center', data: 'right' },
    ]);
  });

  it('column ที่ visible=false ถูกตัดทั้ง head/body', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        { type: 'data', key: 'qty', header: 'ซ่อน', visible: false },
        { type: 'data', key: 'price', header: 'ซ่อนแบบ fn', visible: () => false },
      ]),
      nativeNumeric,
    );

    expect(content.head).toEqual(['สินค้า']);
    expect(content.body[0]).toEqual(['Widget A']);
  });

  it('ทุก column ถูกซ่อน → throw KapomError', () => {
    expect(() =>
      resolveTableContent(
        baseNode([{ type: 'data', key: 'product', header: 'x', visible: false }]),
        nativeNumeric,
      ),
    ).toThrow(KapomError);
  });
});

describe('resolveTableContent — body cell ต่อ column type', () => {
  it('data: ค่า raw เป็น string ตรงๆ; numberFormat → format ตาม th-TH', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        { type: 'data', key: 'price', header: 'ราคา', numberFormat: {} },
      ]),
      nativeNumeric,
    );

    expect(content.body).toEqual([
      ['Widget A', '10.50'],
      ['Widget B', '0.10'],
      ['Widget C', '0.20'],
    ]);
  });

  it('data: formatter/cellRenderer override — cellRenderer ชนะ formatter', () => {
    const content = resolveTableContent(
      baseNode([
        {
          type: 'data',
          key: 'product',
          header: 'a',
          formatter: (v) => `f:${String(v)}`,
        },
        {
          type: 'data',
          key: 'product',
          header: 'b',
          formatter: (v) => `f:${String(v)}`,
          cellRenderer: (v) => `r:${String(v)}`,
        },
      ]),
      nativeNumeric,
    );

    expect(content.body[0]).toEqual(['f:Widget A', 'r:Widget A']);
  });

  it('rowNumber: continuous + startAt + formatter', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'rowNumber', header: '#', startAt: 10 },
        { type: 'rowNumber', header: '##', formatter: (n) => `(${n})` },
      ]),
      nativeNumeric,
    );

    expect(content.body.map((r) => r[0])).toEqual(['10', '11', '12']);
    expect(content.body.map((r) => r[1])).toEqual(['(1)', '(2)', '(3)']);
  });

  it('rowNumber: mode per-page/per-group ยังไม่รองรับ → throw ชัดเจน', () => {
    expect(() =>
      resolveTableContent(
        baseNode([{ type: 'rowNumber', header: '#', mode: 'per-page' }]),
        nativeNumeric,
      ),
    ).toThrow(/per-page/);
  });

  it('computed: คำนวณจาก row + format default เสมอ (เป็น numeric โดย contract)', () => {
    const content = resolveTableContent(
      baseNode([
        {
          type: 'computed',
          header: 'รวม',
          compute: (row) => nativeNumeric.multiply(row.qty, row.price),
        },
      ]),
      nativeNumeric,
    );

    expect(content.body.map((r) => r[0])).toEqual(['21.00', '0.10', '0.60']);
  });

  it('runningTotal: สะสมตามลำดับ render ผ่าน NumericStrategy', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'runningTotal', header: 'สะสม', valueOf: (row) => row.price },
      ]),
      nativeNumeric,
    );

    // 10.50 → 10.60 → 10.80 (0.1+0.2 float artifact ถูก format กลบ)
    expect(content.body.map((r) => r[0])).toEqual(['10.50', '10.60', '10.80']);
  });
});

describe('resolveTableContent — foot (aggregate)', () => {
  it('ไม่มี aggregate เลย → foot เป็น undefined', () => {
    const content = resolveTableContent(
      baseNode([{ type: 'data', key: 'product', header: 'สินค้า' }]),
      nativeNumeric,
    );
    expect(content.foot).toBeUndefined();
  });

  it('sum จาก string decimal + summaryLabel default ที่ column แรก', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        { type: 'data', key: 'price', header: 'ราคา', aggregate: 'sum' },
      ]),
      nativeNumeric,
    );

    expect(content.foot).toEqual([DEFAULT_SUMMARY_LABEL, '10.80']);
  });

  it('summaryLabel กำหนดเอง', () => {
    const node: TableNode<Sale> = {
      ...baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        { type: 'data', key: 'qty', header: 'จำนวน', aggregate: 'sum' },
      ]),
      summaryLabel: 'ยอดรวมทั้งสิ้น',
    };

    expect(resolveTableContent(node, nativeNumeric).foot).toEqual([
      'ยอดรวมทั้งสิ้น',
      '6.00',
    ]);
  });

  it('count เป็นจำนวนเต็ม (ไม่ format ทศนิยม); avg/min/max ผ่าน strategy', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'นับ', aggregate: 'count' },
        { type: 'data', key: 'qty', header: 'เฉลี่ย', aggregate: 'avg' },
        { type: 'data', key: 'price', header: 'ต่ำสุด', aggregate: 'min' },
        { type: 'data', key: 'price', header: 'สูงสุด', aggregate: 'max' },
      ]),
      nativeNumeric,
    );

    expect(content.foot).toEqual(['3', '2.00', '0.10', '10.50']);
  });

  it('custom aggregate fn รับ rows ทั้งหมด', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        {
          type: 'data',
          key: 'price',
          header: 'qty-weighted',
          aggregate: (rows) =>
            nativeNumeric.sum(rows.map((r) => nativeNumeric.multiply(r.qty, r.price))),
        },
      ]),
      nativeNumeric,
    );

    // 2×10.50 + 1×0.10 + 3×0.20 = 21.70
    expect(content.foot).toEqual([DEFAULT_SUMMARY_LABEL, '21.70']);
  });

  it('computed column + aggregate sum', () => {
    const content = resolveTableContent(
      baseNode([
        { type: 'data', key: 'product', header: 'สินค้า' },
        {
          type: 'computed',
          header: 'รวมต่อแถว',
          compute: (row) => nativeNumeric.multiply(row.qty, row.price),
          aggregate: 'sum',
        },
      ]),
      nativeNumeric,
    );

    expect(content.foot).toEqual([DEFAULT_SUMMARY_LABEL, '21.70']);
  });

  it('data เป็น object ที่ format เป็นเลขไม่ได้ → throw fail-fast ไม่ใช่ NaN เงียบ', () => {
    interface Weird {
      value: { nested: boolean };
    }
    const node: TableNode<Weird> = {
      type: 'table',
      columns: [{ type: 'data', key: 'value', header: 'x', aggregate: 'sum' }],
      data: [{ value: { nested: true } }],
    };

    expect(() => resolveTableContent(node, nativeNumeric)).toThrow(KapomError);
  });

  it('data ว่าง → sum/count เป็นศูนย์ ไม่ throw', () => {
    const node: TableNode<Sale> = {
      type: 'table',
      columns: [
        { type: 'data', key: 'product', header: 'สินค้า' },
        { type: 'data', key: 'price', header: 'ราคา', aggregate: 'sum' },
        { type: 'data', key: 'qty', header: 'นับ', aggregate: 'count' },
      ],
      data: [],
    };

    const content = resolveTableContent(node, nativeNumeric);
    expect(content.body).toEqual([]);
    expect(content.foot).toEqual([DEFAULT_SUMMARY_LABEL, '0.00', '0']);
  });
});
