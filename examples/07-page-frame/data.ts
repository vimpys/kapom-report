/**
 * File 1 of 3 — raw data.
 * A long inventory list (80 rows) — long on purpose so the table spans several pages, which is
 * what makes the page frame worth seeing: the header, footer, and page number reprint on every
 * page, including the pages AutoTable creates on its own as the table overflows.
 */

export interface StockRow {
  sku: string;
  item: string;
  qty: number;
}

const ITEMS = [
  'A4 Copy Paper', 'Ballpoint Pen', 'Stapler', 'Staple Refill', 'Sticky Notes',
  'Document Folder', 'Whiteboard Marker', 'Correction Tape', 'Binder Clip', 'Envelope DL',
];

export const stock: StockRow[] = Array.from({ length: 80 }, (_, i) => ({
  sku: `SKU-${String(1000 + i)}`,
  item: `${ITEMS[i % ITEMS.length]} (lot ${Math.floor(i / ITEMS.length) + 1})`,
  qty: ((i * 7) % 40) + 1,
}));
