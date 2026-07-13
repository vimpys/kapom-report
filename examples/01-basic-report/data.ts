/**
 * File 1 of 3 — raw data.
 * One day of coffee-shop sales as plain records — small on purpose (8 rows) so the very first
 * demo fits on a single page: title + table, nothing else.
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
