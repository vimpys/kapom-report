/**
 * Demo — Style resolver: zebra striping + conditional formatting + column-level style
 * Focus: precedence conditional > zebra > column-level > row-type (Typography)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface LedgerEntry {
  description: string;
  amount: number;
}

const ledgerEntries: LedgerEntry[] = [
  { description: 'Opening balance', amount: 5000 },
  { description: 'Client payment — Invoice #101', amount: 1200 },
  { description: 'Office rent', amount: -800 },
  { description: 'Software subscription', amount: -150 },
  { description: 'Client payment — Invoice #102', amount: 2400 },
  { description: 'Refund — Invoice #099', amount: -300 },
  { description: 'Consulting fee', amount: 900 },
];

const ledgerTable: TableNode<LedgerEntry> = {
  type: 'table',
  columns: [
    { type: 'data', key: 'description', header: 'Description' },
    {
      type: 'data',
      key: 'amount',
      header: 'Amount',
      align: 'right',
      numberFormat: {},
      aggregate: 'sum',
      // column-level cellStyle: ranks below zebra/conditional in precedence — also tests that it still
      // shows through when conditional doesn't match (see 'Opening balance', which stays this font and isn't red)
      cellStyle: { fontFamily: 'Sarabun' },
    },
  ],
  data: ledgerEntries,
  summaryLabel: 'Net',
  style: {
    zebra: { even: [255, 255, 255], odd: [245, 247, 250] },
    conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
  },
};

const report = createKapomReport<LedgerEntry>({
  font: fontConfig,
  blocks: [
    {
      type: 'text',
      content: 'Ledger — zebra + conditional (negative = red); precedence conditional > zebra',
      style: { fontSize: 14, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 4 },
    ledgerTable,
  ],
});

saveReport(report, '04-styled-ledger');
