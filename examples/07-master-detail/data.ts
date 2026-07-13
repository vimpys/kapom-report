/**
 * File 1 of 3 — raw data.
 * Payment batches (master) where one batch carries its individual payments (detail).
 * The 35 payments of 'HF/GSP 949027' are generated on purpose — enough volume to force the
 * nested child table itself to overflow onto its own extra page (volume generation is fine per
 * project convention; the point is the page-break, not the content).
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

// enough rows to force the nested Payments table itself to overflow onto its own extra page
const manyPayments: Payment[] = Array.from({ length: 35 }, (_, i) => ({
  date: `${(i % 28) + 1}/${(i % 12) + 1}/2022`,
  card: '****3374',
  method: 'Credit Card',
  billingStatus: 'BILLED',
  amount: '250.00',
}));

export const batches: Batch[] = [
  { batchName: 'DT/OGP 949025', type: 'Check', openDate: '3/31/2022', bank: 'Santander', qty: 9, sumPayments: '2765.50' },
  { batchName: 'DT/OGP 949235', type: 'Check', openDate: '3/31/2022', bank: 'Ally', qty: 5, sumPayments: '10000.00' },
  {
    batchName: 'HF/GSP 949027',
    type: 'Check',
    openDate: '1/30/2022',
    bank: 'Ally',
    qty: manyPayments.length,
    sumPayments: (manyPayments.length * 250).toFixed(2),
    // only this batch has payment detail — every other row's `nested` callback returns undefined
    payments: manyPayments,
  },
  { batchName: 'DT/OGP 947394', type: 'Check', openDate: '3/31/2022', bank: 'Ally', qty: 9, sumPayments: '12765.50' },
  { batchName: 'HF/OGP 902458', type: 'Check', openDate: '3/31/2022', bank: 'Santander', qty: 17, sumPayments: '10000.00' },
];
