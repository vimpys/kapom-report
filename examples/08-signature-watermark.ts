/**
 * Demo — Signature Block + Watermark (roadmap 6d)
 * Focus: { type: 'signature' } — signature line + label, multiple slots, as a Report Footer
 * and the watermark preset `{ text: 'DRAFT' }` — just give a string and get a faint stamp
 * centered on every page (opacity/fontSize/color are defaulted for you; for full custom
 * control you can still write a render callback + withOpacity() yourself — see core/watermark.ts)
 * Uses createKapomReport({ blocks, watermark }) — the facade calls finalize() for you
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 30 }, (_, i) => ({
  product: `Product ${i + 1}`,
  qty: (i % 5) + 1,
}));

const salesTable: TableNode<Sale> = {
  type: 'table',
  columns: [
    { type: 'data', key: 'product', header: 'Product' },
    { type: 'data', key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
};

const report = createKapomReport<Sale>({
  font: fontConfig,
  // preset — centers on the page + opacity 0.15 + fontSize 60 + gray color, all provided for you (each is overridable)
  watermark: { text: 'DRAFT' },
  blocks: [
    { type: 'text', content: 'Monthly Sales Report', role: 'reportTitle' },
    { type: 'spacer', height: 6 },
    salesTable,
    { type: 'spacer', height: 20 },
    {
      type: 'signature',
      slots: [{ label: 'Prepared by' }, { label: 'Reviewed by' }, { label: 'Approved by' }],
    },
  ],
});

saveReport(report, '08-signature-watermark');
