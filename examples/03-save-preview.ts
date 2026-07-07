/**
 * Demo — save + preview
 * Focus: one report, two output paths — save(filename) writes a permanent file,
 * and preview() writes a temp file and opens it immediately with the OS's default PDF viewer
 * (on the browser, use report.doc.output('dataurlnewwindow') from jsPDF directly instead)
 */
import { createKapomReport } from '../src/index';
import { fontConfig, saveReport } from './shared';

interface Sale {
  product: string;
  qty: number;
}

const sales: Sale[] = Array.from({ length: 8 }, (_, i) => ({
  product: `Product ${i + 1}`,
  qty: (i % 5) + 1,
}));

const report = createKapomReport({
  title: 'Save & Preview Demo',
  font: fontConfig,
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'qty', header: 'Qty', align: 'right', aggregate: 'sum' },
  ],
  data: sales,
});

// path 1: save to a permanent file (examples/output, same as every other demo)
saveReport(report, '03-save-preview');

// path 2: preview — writes a temp file + opens the OS's own viewer (returns the path in case you want to delete/reference it)
const previewPath = report.preview();
console.log(`Opening preview: ${previewPath}`);
