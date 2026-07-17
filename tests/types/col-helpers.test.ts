import { describe, expect, it } from 'vitest';
import { col } from '../../src/types/column';

interface Sale {
  product: string;
  qty: number;
}

describe('col<T>() column constructors', () => {
  const c = col<Sale>();

  it('data — key/header positional, extra spread, type = data', () => {
    expect(c.data('qty', 'Qty', { align: 'right', aggregate: 'sum' })).toEqual({
      type: 'data',
      key: 'qty',
      header: 'Qty',
      align: 'right',
      aggregate: 'sum',
    });
  });

  it('data — ไม่ส่ง extra ก็ได้', () => {
    expect(c.data('product', 'Product')).toEqual({ type: 'data', key: 'product', header: 'Product' });
  });

  it('computed — header/compute positional', () => {
    const fn = (row: Sale) => row.qty * 2;
    const out = c.computed('Double', fn, { aggregate: 'sum' });
    expect(out.type).toBe('computed');
    expect(out.header).toBe('Double');
    expect(out.compute).toBe(fn);
    expect(out.aggregate).toBe('sum');
  });

  it('runningTotal — header/valueOf positional', () => {
    const fn = (row: Sale) => row.qty;
    const out = c.runningTotal('Running', fn);
    expect(out).toEqual({ type: 'runningTotal', header: 'Running', valueOf: fn });
  });

  it('rowNumber — header default #, override ได้', () => {
    expect(c.rowNumber()).toEqual({ type: 'rowNumber', header: '#' });
    expect(c.rowNumber({ header: 'No.', align: 'right' })).toEqual({
      type: 'rowNumber',
      header: 'No.',
      align: 'right',
    });
  });

  it('group — header/columns + ซ้อน tree ผ่าน map ได้', () => {
    const g = c.group('Quarterly', [c.data('qty', 'Q1'), c.data('qty', 'Q2')]);
    expect(g.type).toBe('group');
    expect(g.header).toBe('Quarterly');
    expect(g.columns).toHaveLength(2);
  });
});
