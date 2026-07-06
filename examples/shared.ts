/**
 * Helpers shared by every demo — Thai font loading + file output.
 * Each demo is a standalone file (`tsx examples/01-text-blocks.ts`),
 * or run them all with `npm run demo`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FontConfig, KapomReport } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '../tests/fixtures/fonts');
const outDir = join(here, 'output');

/** Sarabun (Google Fonts, OFL) — Thai-capable font used by every demo; registered per engine (VFS is per doc) */
export const fontConfig: FontConfig = {
  fonts: [
    { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Regular.ttf'))), style: 'normal' },
    { family: 'Sarabun', data: new Uint8Array(readFileSync(join(fontsDir, 'Sarabun-Bold.ttf'))), style: 'bold' },
  ],
};

/** Write the PDF to examples/output/<name>.pdf and log the page count — takes a KapomReport from createKapomReport() */
export function saveReport(report: KapomReport, name: string): void {
  mkdirSync(outDir, { recursive: true });
  report.save(join(outDir, `${name}.pdf`));
  console.log(`OK ${name}.pdf (${report.doc.getNumberOfPages()} pages)`);
}
