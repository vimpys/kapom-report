import { describe, expect, it } from 'vitest';
import {
  cellStringContent,
  cellStyleToAutoTableStyles,
  fitRowToGrid,
  mergeFootLabel,
  partialTextStyleToAutoTableStyles,
} from '../../src/table/autotable-styles';
import type { ResolvedAlign } from '../../src/types/column';

describe('cellStyleToAutoTableStyles', () => {
  it('undefined → {}', () => {
    expect(cellStyleToAutoTableStyles(undefined)).toEqual({});
  });

  it('object ว่าง → {}', () => {
    expect(cellStyleToAutoTableStyles({})).toEqual({});
  });

  it('map ครบทุก field', () => {
    expect(
      cellStyleToAutoTableStyles({
        fillColor: [1, 2, 3],
        textColor: [4, 5, 6],
        fontStyle: 'bold',
        fontSize: 12,
        halign: 'right',
      }),
    ).toEqual({
      fillColor: [1, 2, 3],
      textColor: [4, 5, 6],
      fontStyle: 'bold',
      fontSize: 12,
      halign: 'right',
    });
  });

  it('คัดลอกสี (ไม่แชร์ reference กับ input)', () => {
    const fill: [number, number, number] = [1, 2, 3];
    const out = cellStyleToAutoTableStyles({ fillColor: fill });
    expect(out.fillColor).toEqual([1, 2, 3]);
    expect(out.fillColor).not.toBe(fill);
  });

  it('fontSize 0 ต้องติดมาด้วย (เช็ค !== undefined ไม่ใช่ falsy)', () => {
    expect(cellStyleToAutoTableStyles({ fontSize: 0 })).toEqual({ fontSize: 0 });
  });

  it('set เฉพาะ field ที่มี', () => {
    expect(cellStyleToAutoTableStyles({ halign: 'center' })).toEqual({ halign: 'center' });
  });
});

describe('partialTextStyleToAutoTableStyles', () => {
  it('undefined → {}', () => {
    expect(partialTextStyleToAutoTableStyles(undefined)).toEqual({});
  });

  it('เปลี่ยนชื่อ color→textColor และ fontFamily→font', () => {
    expect(
      partialTextStyleToAutoTableStyles({
        fontSize: 10,
        fontStyle: 'italic',
        color: [7, 8, 9],
        fontFamily: 'Sarabun',
      }),
    ).toEqual({
      fontSize: 10,
      fontStyle: 'italic',
      textColor: [7, 8, 9],
      font: 'Sarabun',
    });
  });

  it('คัดลอก color (ไม่แชร์ reference)', () => {
    const color: [number, number, number] = [7, 8, 9];
    const out = partialTextStyleToAutoTableStyles({ fontSize: 10, color });
    expect(out.textColor).toEqual([7, 8, 9]);
    expect(out.textColor).not.toBe(color);
  });

  it('fontSize 0 ต้องติดมาด้วย', () => {
    expect(partialTextStyleToAutoTableStyles({ fontSize: 0 })).toEqual({ fontSize: 0 });
  });
});

describe('cellStringContent', () => {
  it('string ธรรมดา → ตัวมันเอง', () => {
    expect(cellStringContent('hello')).toBe('hello');
  });

  it('empty string → "" (ยังเป็น string)', () => {
    expect(cellStringContent('')).toBe('');
  });

  it('CellDef { content: string } → content', () => {
    expect(cellStringContent({ content: 'x' })).toBe('x');
  });

  it('content ที่ไม่ใช่ string → undefined', () => {
    expect(cellStringContent({ content: 123 })).toBeUndefined();
  });

  it('number / null / object ไม่มี content → undefined', () => {
    expect(cellStringContent(123)).toBeUndefined();
    expect(cellStringContent(null)).toBeUndefined();
    expect(cellStringContent({ colSpan: 2 })).toBeUndefined();
  });
});

describe('mergeFootLabel', () => {
  it('labelIndex -1 (ไม่มี label) → copy ของ foot', () => {
    const foot = ['a', 'b'];
    const out = mergeFootLabel(foot, -1);
    expect(out).toEqual(['a', 'b']);
    expect(out).not.toBe(foot);
  });

  it('ไม่มีช่องว่างตามหลัง (span 1) → copy เฉยๆ', () => {
    expect(mergeFootLabel(['Total', '100', '200'], 0)).toEqual(['Total', '100', '200']);
  });

  it('รวม label กับช่องว่างที่ตามมาเป็น colSpan cell เดียว', () => {
    const out = mergeFootLabel(['#', 'Total', '', '', '999'], 1);
    expect(out).toEqual([
      '#',
      { content: 'Total', colSpan: 3, styles: { halign: 'left' } },
      '999',
    ]);
  });

  it('หยุด span ที่ช่องแรกที่ไม่ว่าง', () => {
    const out = mergeFootLabel(['Total', '', 'x', ''], 0);
    expect(out).toEqual([{ content: 'Total', colSpan: 2, styles: { halign: 'left' } }, 'x', '']);
  });

  it('label ตัวสุดท้าย + ช่องว่างจนจบ', () => {
    const out = mergeFootLabel(['a', 'Sum', '', ''], 1);
    expect(out).toEqual(['a', { content: 'Sum', colSpan: 3, styles: { halign: 'left' } }]);
  });
});

describe('fitRowToGrid', () => {
  const aligns: ResolvedAlign[] = [
    { header: 'left', data: 'right' },
    { header: 'center', data: 'center' },
  ];

  it('cell สุดท้าย colSpan เติมเต็ม grid ที่กว้างกว่า', () => {
    const out = fitRowToGrid(['A', 'B'], aligns, 'data', 4);
    expect(out).toEqual([
      { content: 'A', colSpan: 1, styles: { halign: 'right' } },
      { content: 'B', colSpan: 3, styles: { halign: 'center' } },
    ]);
  });

  it('gridCols เท่าจำนวน value → ทุก cell colSpan 1', () => {
    const out = fitRowToGrid(['A', 'B'], aligns, 'header', 2);
    expect(out).toEqual([
      { content: 'A', colSpan: 1, styles: { halign: 'left' } },
      { content: 'B', colSpan: 1, styles: { halign: 'center' } },
    ]);
  });

  it('align ที่ไม่มีใน aligns → default left; merge extra styles', () => {
    const out = fitRowToGrid(['A', 'B', 'C'], aligns, 'data', 3, { fillColor: [9, 9, 9] });
    expect(out[2]).toEqual({ content: 'C', colSpan: 1, styles: { halign: 'left', fillColor: [9, 9, 9] } });
    expect(out[0]?.styles).toMatchObject({ halign: 'right', fillColor: [9, 9, 9] });
  });
});
