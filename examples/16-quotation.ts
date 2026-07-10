import { createKapomReport } from '../src/index';
import { saveReport } from './shared';

interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const sampleQuotation = {
  quoteNumber: 'QT-2026-001',
  date: '2026-07-10',
  expiryDate: '2026-08-10',
  clientName: 'Acme Corporation',
  clientEmail: 'contact@acme.com',
  items: [
    { description: 'Consulting Services (20 hours)', quantity: 20, unitPrice: 150 },
    { description: 'Development - Custom Module', quantity: 1, unitPrice: 2500 },
    { description: 'Testing & QA', quantity: 16, unitPrice: 120 },
    { description: 'Documentation', quantity: 8, unitPrice: 100 },
  ] as QuotationItem[],
  taxRate: 0.1,
  notes: 'Valid for 30 days. Payment terms: Net 30. 50% deposit required to start work.',
};

function calculateTotals() {
  const subtotal = sampleQuotation.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = subtotal * sampleQuotation.taxRate;
  return { subtotal, tax, total: subtotal + tax };
}

function formatItemsText() {
  const lines = ['Description                      Qty    Unit Price'];
  lines.push('─'.repeat(70));
  for (const item of sampleQuotation.items) {
    const description = item.description.padEnd(30);
    const qty = String(item.quantity).padStart(4);
    const price = `$${item.unitPrice.toFixed(2)}`.padStart(15);
    lines.push(`${description} ${qty} ${price}`);
  }
  return lines.join('\n');
}

const report = createKapomReport({
  document: { orientation: 'portrait', format: 'letter' },
  blocks: [
    { type: 'text', content: 'QUOTATION', style: { fontSize: 24, fontStyle: 'bold' } },
    { type: 'spacer', height: 4 },
    {
      type: 'text',
      content: `Quote #: ${sampleQuotation.quoteNumber}\nDate: ${sampleQuotation.date}\nValid Until: ${sampleQuotation.expiryDate}`,
      style: { fontSize: 10 },
    },
    { type: 'spacer', height: 12 },
    { type: 'text', content: 'Bill To:', style: { fontSize: 12, fontStyle: 'bold' } },
    {
      type: 'text',
      content: `${sampleQuotation.clientName}\n${sampleQuotation.clientEmail}`,
      style: { fontSize: 10 },
    },
    { type: 'spacer', height: 16 },
    { type: 'text', content: 'Line Items:', style: { fontSize: 11, fontStyle: 'bold' } },
    {
      type: 'text',
      content: formatItemsText(),
      style: { fontSize: 9 },
    },
    { type: 'spacer', height: 12 },
    {
      type: 'text',
      content: `Subtotal              $${calculateTotals().subtotal.toFixed(2)}\nTax (10%)              $${calculateTotals().tax.toFixed(2)}\n\nTOTAL                 $${calculateTotals().total.toFixed(2)}`,
      style: { fontSize: 11, fontStyle: 'bold' },
    },
    { type: 'spacer', height: 16 },
    { type: 'text', content: 'Terms & Conditions:', style: { fontSize: 10, fontStyle: 'bold' } },
    { type: 'text', content: sampleQuotation.notes, style: { fontSize: 9 } },
    { type: 'spacer', height: 16 },
    { type: 'signature', slots: [{ label: 'Authorized By' }, { label: 'Client Signature' }], signHeight: 20 },
  ],
});

saveReport(report, 'quotation');
