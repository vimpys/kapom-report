/**
 * Demo — master-detail (nested tables, roadmap 10.5)
 * Focus: `TableNode.nested` returns a sub-table per row — a row with a child table renders it
 * indented right underneath (real feature, not a mockup); `nestedIndentColumn` picks which
 * column of the master table the child's left edge lines up with (grid-aligned, computed from
 * the master's own resolved column widths — not an approximate offset)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine/TableBlock directly
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Payment {
  date: string;
  card: string;
  method: string;
  billingStatus: string;
  amount: string;
}

interface Batch {
  batchName: string;
  type: string;
  openDate: string;
  bank: string;
  qty: number;
  sumPayments: string;
  payments?: Payment[];
}

const batches: Batch[] = [
  { batchName: 'DT/OGP 949025', type: 'Check', openDate: '3/31/2022', bank: 'Santander', qty: 9, sumPayments: '2765.50' },
  { batchName: 'DT/OGP 949235', type: 'Check', openDate: '3/31/2022', bank: 'Ally', qty: 5, sumPayments: '10000.00' },
  {
    batchName: 'HF/GSP 949027',
    type: 'Check',
    openDate: '1/30/2022',
    bank: 'Ally',
    qty: 3,
    sumPayments: '750.00',
    // only this batch has payment detail — every other row's `nested` callback returns undefined
    payments: [
      { date: '1/30/2022', card: '****3374', method: 'Credit Card', billingStatus: 'BILLED', amount: '250.00' },
      { date: '2/28/2022', card: '****3374', method: 'Credit Card', billingStatus: 'BILLED', amount: '250.00' },
      { date: '3/30/2022', card: '****3374', method: 'Credit Card', billingStatus: 'BILLED', amount: '250.00' },
    ],
  },
  { batchName: 'DT/OGP 947394', type: 'Check', openDate: '3/31/2022', bank: 'Ally', qty: 9, sumPayments: '12765.50' },
  { batchName: 'HF/OGP 902458', type: 'Check', openDate: '3/31/2022', bank: 'Santander', qty: 17, sumPayments: '10000.00' },
];

const batchTable: TableNode<Batch> = {
  type: 'table',
  columns: [
    { type: 'data', key: 'batchName', header: 'Batch Name' },
    { type: 'data', key: 'type', header: 'Type' },
    { type: 'data', key: 'openDate', header: 'Open Date' },
    { type: 'data', key: 'bank', header: 'Bank' },
    { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
    { type: 'data', key: 'sumPayments', header: 'Sum Payments', align: 'right', numberFormat: {}, aggregate: 'sum' },
  ],
  data: batches,
  summaryLabel: 'Grand Total',
  // undefined = this row has no detail to show — only 'HF/GSP 949027' returns a real child table
  nested: (row) =>
    row.payments && ({
      type: 'table',
      columns: [
        { type: 'data', key: 'date', header: 'Date' },
        { type: 'data', key: 'card', header: 'Card#' },
        { type: 'data', key: 'method', header: 'Method' },
        { type: 'data', key: 'billingStatus', header: 'Billing Status' },
        { type: 'data', key: 'amount', header: 'Amount', align: 'right', numberFormat: {} },
      ],
      data: row.payments,
    } satisfies TableNode<Payment> as unknown as TableNode<unknown>),
  // the child's left edge lines up with column 3 ("Bank") of the master table
  nestedIndentColumn: 3,
};

const report = createKapomReport<Batch>({
  font: fontConfig,
  blocks: [
    {
      type: 'text',
      content: 'Master-detail — TableNode.nested returns a sub-table per row',
      style: { fontSize: 14, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 4 },
    batchTable,
  ],
});

saveReport(report, '15-master-detail');
