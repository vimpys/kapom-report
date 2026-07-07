/**
 * Demo — createKapomReport facade (roadmap 8)
 * Focus: the real public API a user reaches for — no need to call new jsPDF()/RenderEngine/
 * createBlock directly like demos 01-09 do; column shorthand ({ key, header } without `type`)
 * + group shorthand (a string key) + title — all converted into the same ReportNode tree
 * under the hood via resolveReportConfig()
 * + document: { orientation, format } passed straight into new jsPDF() — letter/landscape instead of the a4/portrait default
 */
import { createKapomReport } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  category: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 20 }, (_, i) => ({
  product: `Product ${i + 1}`,
  category: i % 2 === 0 ? 'Food' : 'Drink',
  qty: (i % 5) + 1,
}));

const report = createKapomReport({
  title: 'Monthly Sales Report',
  font: fontConfig,
  document: { orientation: 'landscape', format: 'letter' }, // omit this = jsPDF's own a4/portrait default
  group: 'category', // layer 2 shorthand — compare with examples/06-grouped-report.ts, which writes a full GroupResolver by hand
  columns: [
    // layer 1 shorthand — no `type` at all, normalized into a DataColumn for you
    { key: 'product', header: 'Product' },
    { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
});

saveReport(report, '01-facade');
