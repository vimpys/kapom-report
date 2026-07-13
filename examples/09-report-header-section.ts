/**
 * Demo — Report Header + Section/Stack composite (roadmap 6b)
 * Focus: TextNode.role uses a Typography token (reportTitle/reportSubtitle/sectionHeading)
 * as its base style + { type: 'section' }/{ type: 'stack' } render children in order
 * (measureHeight sums recursively, per-child ensureSpace keeps children from spilling off the page)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport } from '../src/index';
import type { TableNode } from '../src/index';
import { fontConfig, outPath } from './shared';

interface Sale {
  product: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 10 }, (_, i) => ({
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

// report header = a stack of text nodes using a Typography token via `role` (no need to set style manually)
const report = createKapomReport<Sale>({
  font: fontConfig,
  blocks: [
    {
      type: 'stack',
      children: [
        // text shorthand in children: no need for `type: 'text'`
        { content: 'Monthly Sales Report', role: 'reportTitle' },
        { content: 'January 2026 — All Regions', role: 'reportSubtitle' },
      ],
    },
    { type: 'spacer', height: 6 },
    // section = stack + name (name is used by the Report Registry to select a section — see demo 07)
    {
      type: 'section',
      name: 'sales-summary',
      children: [
        { content: 'Sales Summary', role: 'sectionHeading' },
        { type: 'spacer', height: 3 },
        salesTable,
      ],
    },
  ],
});

report.save(outPath('09-report-header-section'));
console.log(`OK 09-report-header-section.pdf (${report.doc.getNumberOfPages()} pages)`);
