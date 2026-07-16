/**
 * File 1 of 3 — raw data.
 * Payment batches (master), each carrying its own individual payments (detail). Every batch has
 * payments so the 'stacked' nested layout shows one self-contained block per batch. One batch
 * ('HF/GSP 949027') has 35 payments on purpose — enough to force its block to overflow onto a
 * second page, so you can see the master identity header repeat there (volume generation is fine
 * per project convention; the point is the page-break behaviour, not the content).
 */

export interface Payment {
  date: string;
  card: string;
  method: string;
  billingStatus: string;
  amount: string;
}

export interface Batch {
  batchName: string;
  type: string;
  openDate: string;
  bank: string;
  qty: number;
  sumPayments: string;
  payments?: Payment[];
}

/** n payments of a fixed amount, dated weekly — keeps every batch's Qty × amount = Sum tidy */
function makePayments(count: number, amount: number, card: string): Payment[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `${((i * 7) % 28) + 1}/${(i % 12) + 1}/2022`,
    card,
    method: 'Credit Card',
    billingStatus: 'BILLED',
    amount: amount.toFixed(2),
  }));
}

function batch(batchName: string, bank: string, openDate: string, count: number, amount: number, card: string): Batch {
  return {
    batchName,
    type: 'Check',
    openDate,
    bank,
    qty: count,
    sumPayments: (count * amount).toFixed(2),
    payments: makePayments(count, amount, card),
  };
}

export const batches: Batch[] = [
  batch('DT/OGP 949025', 'Santander', '3/31/2022', 4, 691.375, '****1180'),
  batch('DT/OGP 949235', 'Ally', '3/31/2022', 3, 3333.333, '****7742'),
  // this one overflows onto a second page — watch its identity header repeat there
  batch('HF/GSP 949027', 'Ally', '1/30/2022', 35, 250, '****3374'),
  batch('DT/OGP 947394', 'Ally', '3/31/2022', 5, 2553.1, '****5561'),
  batch('HF/OGP 902458', 'Santander', '3/31/2022', 6, 1666.667, '****9910'),
];
