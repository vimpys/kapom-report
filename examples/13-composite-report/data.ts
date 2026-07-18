/**
 * File 1 of 4 — raw data.
 * Two independently-shaped datasets for one document: a Sales list and an Expenses list.
 * The two feed two different section builders (see sections.ts) — the whole point of the
 * composite: heterogeneous sections assembled into a single report.
 */

export interface Sale {
  product: string;
  customer: string;
  amount: number;
}

export interface Expense {
  category: string;
  vendor: string;
  amount: number;
}

export const sales: Sale[] = [
  { product: 'Alice Mutton', customer: 'ANTON', amount: 3120.0 },
  { product: 'Alice Mutton', customer: 'ERNSH', amount: 6818.0 },
  { product: 'Aniseed Syrup', customer: 'ALFKI', amount: 580.0 },
  { product: 'Aniseed Syrup', customer: 'QUICK', amount: 1962.0 },
  { product: 'Boston Crab Meat', customer: 'BONAP', amount: 1416.0 },
  { product: 'Boston Crab Meat', customer: 'HILAA', amount: 2793.0 },
  { product: 'Camembert Pierrot', customer: 'FOLKO', amount: 4131.0 },
  { product: 'Camembert Pierrot', customer: 'MEREP', amount: 2048.0 },
  { product: 'Chang', customer: 'BLONP', amount: 1941.0 },
  { product: 'Chang', customer: 'FRANK', amount: 2550.0 },
  { product: 'Gorgonzola Telino', customer: 'SAVEA', amount: 2200.0 },
  { product: 'Gorgonzola Telino', customer: 'WHITC', amount: 2950.0 },
];

export const expenses: Expense[] = [
  { category: 'Staff Wages', vendor: 'Payroll', amount: 18500.0 },
  { category: 'Utilities', vendor: 'City Power & Water', amount: 3240.0 },
  { category: 'Rent', vendor: 'Riverside Properties', amount: 9000.0 },
  { category: 'Marketing', vendor: 'BrightAds Co.', amount: 2750.0 },
  { category: 'Maintenance', vendor: 'FixIt Services', amount: 1480.0 },
  { category: 'Software', vendor: 'kapom-soft', amount: 960.0 },
];
