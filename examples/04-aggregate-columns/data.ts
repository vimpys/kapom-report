/**
 * File 1 of 3 — raw data.
 * Order lines from an office-supplies store. The catalog (names + unit prices) is literal;
 * the 45 order lines are generated from it (3 weekly batches × 15 products with varying qty) —
 * volume generation is fine per project convention, because the point here is a table long
 * enough to overflow across pages, not the content itself.
 *
 * `price` stays a string on purpose — matching a DECIMAL column from a DB; the lib accepts
 * Decimalish (number | string) as-is, no conversion needed.
 */

export interface OrderLine {
  product: string;
  qty: number;
  price: string;
}

interface CatalogItem {
  name: string;
  price: string;
}

const catalog: CatalogItem[] = [
  { name: 'A4 Copy Paper (ream)', price: '4.50' },
  { name: 'Ballpoint Pen (box of 12)', price: '6.90' },
  { name: 'Stapler', price: '12.50' },
  { name: 'Staple Refill', price: '2.25' },
  { name: 'Sticky Notes (pack)', price: '3.75' },
  { name: 'Document Folder', price: '1.80' },
  { name: 'Whiteboard Marker (set)', price: '8.40' },
  { name: 'Correction Tape', price: '2.90' },
  { name: 'Binder Clip (box)', price: '4.10' },
  { name: 'Envelope DL (pack of 50)', price: '5.60' },
  { name: 'Ink Cartridge — Black', price: '24.90' },
  { name: 'Ink Cartridge — Color', price: '32.50' },
  { name: 'Desk Organizer', price: '15.75' },
  { name: 'Scissors 8"', price: '7.20' },
  { name: 'Packing Tape (roll)', price: '3.40' },
];

/** 3 weekly restock orders over the same catalog, with quantity varying by week */
export const orderLines: OrderLine[] = [1, 2, 3].flatMap((week) =>
  catalog.map((item, i) => ({
    product: item.name,
    qty: ((i + week) % 7) + 1,
    price: item.price,
  })),
);
