import { describe, expect, it } from 'vitest';
import type { ReportColumn } from '../../src/types/column';
import { isNumericColumn, resolveColumnAlign } from '../../src/types/column';

interface Row {
  name: string;
  qty: number;
  price: string;
  orderNo: number;
}

const dataAlign = (col: ReportColumn<Row>): string => resolveColumnAlign(col).data;

/**
 * Columns already known to hold numbers align right without being told. "Known" means declared —
 * by `type` or by `numberFormat` — never inferred from the values, which is what keeps a column of
 * order numbers out of it.
 */
describe('resolveColumnAlign — ชิดขวาอัตโนมัติเมื่อรู้ว่าเป็นตัวเลข', () => {
  it('type ที่เป็นตัวเลขตาม contract → ชิดขวาโดยไม่ต้องเขียน align', () => {
    expect(dataAlign({ type: 'rowNumber', header: '#' })).toBe('right');
    expect(dataAlign({ type: 'computed', header: 'Total', compute: (r) => r.qty })).toBe('right');
    expect(dataAlign({ type: 'runningTotal', header: 'Run', valueOf: (r) => r.qty })).toBe('right');
  });

  it('data column ที่ตั้ง numberFormat = ประกาศเองแล้วว่าเป็นตัวเลข → ชิดขวา', () => {
    expect(dataAlign({ key: 'price', header: 'Price', numberFormat: {} })).toBe('right');
    expect(dataAlign({ key: 'price', header: 'Price', numberFormat: { fractionDigits: 2 } })).toBe('right');
  });

  it('data column ธรรมดายังชิดซ้ายเหมือนเดิม แม้ค่าจริงจะเป็นตัวเลข', () => {
    // qty เป็น number แต่ไม่ได้ประกาศอะไร — ระลอกนี้ไม่สแกนข้อมูล จึงไม่แตะ
    expect(dataAlign({ key: 'qty', header: 'Qty' })).toBe('left');
    expect(dataAlign({ key: 'name', header: 'Name' })).toBe('left');
  });

  it('คอลัมน์รหัส/เลขที่เอกสารไม่ถูกแตะ — เหตุผลที่ไม่อนุมานจากข้อมูล', () => {
    expect(dataAlign({ key: 'orderNo', header: 'Order No' })).toBe('left');
  });

  it('align ที่เขียนเองชนะเสมอ ทั้งสองทาง', () => {
    expect(dataAlign({ key: 'price', header: 'Price', numberFormat: {}, align: 'left' })).toBe('left');
    expect(dataAlign({ type: 'rowNumber', header: '#', align: 'center' })).toBe('center');
    expect(dataAlign({ key: 'name', header: 'Name', align: 'right' })).toBe('right');
  });

  it('header ยัง default center ไม่เปลี่ยนตาม data align', () => {
    expect(resolveColumnAlign({ key: 'price', header: 'Price', numberFormat: {} })).toEqual({
      data: 'right',
      header: 'center',
    });
  });
});

describe('isNumericColumn — ตัดสินจาก config ไม่ใช่จากข้อมูล', () => {
  it('true เฉพาะที่ประกาศความเป็นตัวเลขไว้', () => {
    expect(isNumericColumn({ type: 'rowNumber', header: '#' })).toBe(true);
    expect(isNumericColumn({ type: 'computed', header: 'T', compute: (r: Row) => r.qty })).toBe(true);
    expect(isNumericColumn({ type: 'runningTotal', header: 'R', valueOf: (r: Row) => r.qty })).toBe(true);
    expect(isNumericColumn<Row>({ key: 'price', header: 'P', numberFormat: {} })).toBe(true);
  });

  it('false สำหรับ data column ที่ไม่ได้ประกาศ แม้ค่าจะเป็นตัวเลข', () => {
    expect(isNumericColumn<Row>({ key: 'qty', header: 'Qty' })).toBe(false);
    expect(isNumericColumn<Row>({ key: 'orderNo', header: 'Order No' })).toBe(false);
    // aggregate: 'sum' ก็ยังไม่พอ — มันบอกว่าจะรวม ไม่ได้บอกว่าจะแสดงผลยังไง
    expect(isNumericColumn<Row>({ key: 'qty', header: 'Qty', aggregate: 'sum' })).toBe(false);
  });
});
