/**
 * File 1 of 3 — raw data.
 * A short sales table (8 rows) — short on purpose so it ends in the middle of the page, which is
 * what makes the two signature placements easy to tell apart: a signature in the flow sits right
 * after the table (mid-page), while a pinned one drops to the very bottom regardless.
 */

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
