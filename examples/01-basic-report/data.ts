/**
 * File 1 of 3 — raw data for the combined report.
 * This demo joins three small tables into one document (separated by pageBreak()):
 *   1. Sales      — the smallest possible table (product + qty)
 *   2. Ledger     — mixed +/- amounts, to show zebra + conditional formatting
 *   3. OrderLines — a longer table that overflows pages, to show rowNumber/computed/runningTotal
 * Self-contained on purpose (its own data) so it doesn't depend on the other demo folders.
 */

// ── 1. coffee-shop sales — 8 rows, fits one page ──
export interface Sale {
  product: string;
  qty: number;
}

export const sales: Sale[] = [
  { product: 'Americano', qty: 42 },
  { product: 'Latte', qty: 38 },
  { product: 'Cappuccino', qty: 25 },
  { product: 'Thai Iced Tea', qty: 31 },
  { product: 'Green Tea Latte', qty: 18 },
  { product: 'Croissant', qty: 22 },
  { product: 'Butter Cake', qty: 15 },
  { product: 'Cheesecake', qty: 12 },
];

// ── 2. cash ledger — mixed positive/negative amounts (negative renders red via conditional) ──
export interface LedgerEntry {
  /** ISO date (yyyy-mm-dd) — rendered through formatDate() by the template */
  date: string;
  description: string;
  amount: number;
}

export const ledgerEntries: LedgerEntry[] = [
  { date: '2026-07-01', description: 'Opening balance', amount: 5000 },
  { date: '2026-07-02', description: 'Client payment — Invoice #101', amount: 1200 },
  { date: '2026-07-03', description: 'Office rent', amount: -800 },
  { date: '2026-07-05', description: 'Software subscription', amount: -150 },
  { date: '2026-07-08', description: 'Client payment — Invoice #102', amount: 2400 },
  { date: '2026-07-09', description: 'Refund — Invoice #099', amount: -300 },
  { date: '2026-07-11', description: 'Consulting fee', amount: 900 },
];

// ── 3. order lines — 15 rows from a literal catalog (one restock batch) ──
// Kept to one page so its section heading stays with the table (a heading right before an
// *overflowing* table would be orphaned by the table's measureHeight estimate — demo 04 keeps the
// full 45-row overflow version). `price` stays a string on purpose — matching a DECIMAL column
// from a DB (the lib accepts Decimalish = number | string as-is, no conversion needed).
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

/** one restock batch over the catalog (15 lines) */
export const orderLines: OrderLine[] = catalog.map((item, i) => ({
  product: item.name,
  qty: (i % 7) + 1,
  price: item.price,
}));
