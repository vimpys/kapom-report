/**
 * File 1 of 3 — raw data.
 * A small cash ledger as plain records — mixed positive/negative amounts on purpose so the
 * template's conditional formatting (negative = red) has both cases to show.
 */

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
