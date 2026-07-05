import { describe, expect, it } from 'vitest';
import { resolveRowStyle } from '../../src/style/resolve-cell-style';
import type { TableStyleOptions } from '../../src/types/node';

interface Row {
  amount: number;
}

describe('resolveRowStyle — ไม่มี options', () => {
  it('คืน object ว่างเสมอ', () => {
    expect(resolveRowStyle(undefined, { amount: 1 }, 0)).toEqual({});
  });
});

describe('resolveRowStyle — zebra', () => {
  const zebraOnly: TableStyleOptions<Row> = {
    zebra: { even: [255, 255, 255], odd: [240, 240, 240] },
  };

  it('rowIndex คู่ (0-based) → even color', () => {
    expect(resolveRowStyle(zebraOnly, { amount: 1 }, 0)).toEqual({
      fillColor: [255, 255, 255],
    });
    expect(resolveRowStyle(zebraOnly, { amount: 1 }, 2)).toEqual({
      fillColor: [255, 255, 255],
    });
  });

  it('rowIndex คี่ → odd color', () => {
    expect(resolveRowStyle(zebraOnly, { amount: 1 }, 1)).toEqual({
      fillColor: [240, 240, 240],
    });
  });

  it('zebra ระบุแค่ even → rowIndex คี่ไม่ได้ fillColor', () => {
    const evenOnly: TableStyleOptions<Row> = { zebra: { even: [255, 255, 255] } };
    expect(resolveRowStyle(evenOnly, { amount: 1 }, 1)).toEqual({});
  });
});

describe('resolveRowStyle — conditional', () => {
  const conditionalOnly: TableStyleOptions<Row> = {
    conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
  };

  it('เงื่อนไขตรง → คืน style ที่ conditional กำหนด', () => {
    expect(resolveRowStyle(conditionalOnly, { amount: -5 }, 0)).toEqual({
      textColor: [220, 38, 38],
    });
  });

  it('เงื่อนไขไม่ตรง (คืน undefined) → ไม่มี override', () => {
    expect(resolveRowStyle(conditionalOnly, { amount: 5 }, 0)).toEqual({});
  });

  it('conditional ได้รับ rowIndex ด้วย', () => {
    let receivedIndex: number | undefined;
    const options: TableStyleOptions<Row> = {
      conditional: (_row, rowIndex) => {
        receivedIndex = rowIndex;
        return undefined;
      },
    };
    resolveRowStyle(options, { amount: 1 }, 7);
    expect(receivedIndex).toBe(7);
  });
});

describe('resolveRowStyle — precedence: conditional > zebra', () => {
  it('conditional คืนค่า → ทับ zebra ทั้งหมด', () => {
    const options: TableStyleOptions<Row> = {
      zebra: { even: [255, 255, 255], odd: [240, 240, 240] },
      conditional: (row) => (row.amount < 0 ? { fillColor: [220, 38, 38] } : undefined),
    };

    // rowIndex 0 (even) ปกติจะได้ zebra even แต่ conditional ทับเป็นแดง
    expect(resolveRowStyle(options, { amount: -1 }, 0)).toEqual({
      fillColor: [220, 38, 38],
    });
  });

  it('conditional คืน undefined → fall through ไป zebra ตามปกติ', () => {
    const options: TableStyleOptions<Row> = {
      zebra: { even: [255, 255, 255], odd: [240, 240, 240] },
      conditional: (row) => (row.amount < 0 ? { fillColor: [220, 38, 38] } : undefined),
    };

    expect(resolveRowStyle(options, { amount: 1 }, 1)).toEqual({
      fillColor: [240, 240, 240],
    });
  });

  it('conditional คืน field ที่ต่างจาก zebra (เช่น textColor) → merge ทั้งคู่อยู่ได้ ไม่ทับกัน', () => {
    const options: TableStyleOptions<Row> = {
      zebra: { even: [255, 255, 255], odd: [240, 240, 240] },
      conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
    };

    expect(resolveRowStyle(options, { amount: -1 }, 0)).toEqual({
      fillColor: [255, 255, 255],
      textColor: [220, 38, 38],
    });
  });
});
