/**
 * Demo — Style resolver: zebra striping + conditional formatting + column-level style
 * โฟกัส: precedence conditional > zebra > column-level > row-type (Typography)
 * เรียกผ่าน createKapomReport({ blocks }) — ไม่ต้องแตะ jsPDF/RenderEngine เอง
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
      // column-level cellStyle: อยู่ต่ำกว่า zebra/conditional ใน precedence — ทดสอบด้วยว่ายังโผล่ได้
      // เมื่อ conditional ไม่ตรง (ดู 'Opening balance' ที่ยังเป็น monospace ปกติไม่แดง)
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
