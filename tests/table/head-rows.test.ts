import type { CellDef, RowInput } from 'jspdf-autotable';
import { describe, expect, it } from 'vitest';
import { buildHeadRows } from '../../src/table/head-rows';
import type { TableColumn } from '../../src/types/column';

interface Row {
  name: string;
  q1: number;
  q2: number;
  total: number;
}

/** grouped-head rows are CellDef[][]; narrow for property assertions */
const asCellRows = (rows: RowInput[]): CellDef[][] => rows as CellDef[][];

describe('buildHeadRows — flat header', () => {
  it('คอลัมน์ leaf ล้วน → head แถวเดียวเป็น string[]', () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name' },
      { key: 'total', header: 'Total' },
    ];
    expect(buildHeadRows(columns)).toEqual([['Name', 'Total']]);
  });

  it('ข้ามคอลัมน์ที่ visible:false', () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name' },
      { key: 'q1', header: 'Q1', visible: false },
      { key: 'total', header: 'Total' },
    ];
    expect(buildHeadRows(columns)).toEqual([['Name', 'Total']]);
  });
});

describe('buildHeadRows — grouped header', () => {
  const columns: TableColumn<Row>[] = [
    { key: 'name', header: 'Name' },
    {
      type: 'group',
      header: 'Sales',
      columns: [
        { key: 'q1', header: 'Q1' },
        { key: 'q2', header: 'Q2' },
      ],
    },
    { key: 'total', header: 'Total' },
  ];

  it('มี group → head 2 แถว', () => {
    expect(buildHeadRows(columns)).toHaveLength(2);
  });

  it('super-header colSpan = จำนวน leaf; leaf rowSpan ยืดถึงล่างสุด', () => {
    const rows = asCellRows(buildHeadRows(columns));
    // row 0: [Name(rowSpan 2), Sales(colSpan 2), Total(rowSpan 2)]  (ลำดับตาม topColumns)
    const [name, sales, total] = rows[0] as CellDef[];
    expect(name).toMatchObject({ content: 'Name', rowSpan: 2 });
    expect(sales).toMatchObject({ content: 'Sales', colSpan: 2 });
    expect(total).toMatchObject({ content: 'Total', rowSpan: 2 });

    // row 1: [Q1, Q2] เป็น leaf ของ group (rowSpan 1)
    const [q1, q2] = rows[1] as CellDef[];
    expect(q1).toMatchObject({ content: 'Q1', rowSpan: 1 });
    expect(q2).toMatchObject({ content: 'Q2', rowSpan: 1 });
  });

  it('super-header default halign center; headerAlign override ได้', () => {
    const rows = asCellRows(buildHeadRows(columns));
    expect((rows[0]?.[1] as CellDef).styles).toMatchObject({ halign: 'center' });

    const overridden: TableColumn<Row>[] = [
      { type: 'group', header: 'S', headerAlign: 'left', columns: [{ key: 'q1', header: 'Q1' }] },
    ];
    const r = asCellRows(buildHeadRows(overridden));
    expect((r[0]?.[0] as CellDef).styles).toMatchObject({ halign: 'left' });
  });

  it('leaf headerStyle map เข้าไปใน cell styles', () => {
    const styled: TableColumn<Row>[] = [
      {
        type: 'group',
        header: 'G',
        columns: [{ key: 'q1', header: 'Q1', headerStyle: { fillColor: [1, 2, 3] } }],
      },
    ];
    const rows = asCellRows(buildHeadRows(styled));
    expect((rows[1]?.[0] as CellDef).styles).toMatchObject({ fillColor: [1, 2, 3] });
  });

  it('group ซ้อน group (3 ระดับ) → head 3 แถว', () => {
    const nested: TableColumn<Row>[] = [
      {
        type: 'group',
        header: 'Year',
        columns: [
          {
            type: 'group',
            header: 'H1',
            columns: [
              { key: 'q1', header: 'Q1' },
              { key: 'q2', header: 'Q2' },
            ],
          },
        ],
      },
    ];
    const rows = buildHeadRows(nested);
    expect(rows).toHaveLength(3);
    // แถวสุดท้ายคือ leaf Q1/Q2
    expect(asCellRows(rows)[2]?.map((c) => c.content)).toEqual(['Q1', 'Q2']);
  });
});
