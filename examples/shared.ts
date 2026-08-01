/**
 * Helpers shared by every demo — Thai font loading + the demo suite's output path.
 * Each demo is a standalone folder/file, or run them all with `npm run demo`.
 *
 * Demos call the real library API directly — `report.save(outPath('01-basic-report'))` — so the
 * code you copy from a demo is exactly the code you would write yourself. The only shared pieces
 * are things that are the *user's* concern anyway, never the library's: font registration (you
 * supply your own font files) and where this demo suite keeps its PDFs.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FontConfig } from '../src/index';

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

/** absolute path for a demo PDF — examples/output/<name>.pdf (the folder is created on first use) */
export function outPath(name: string): string {
  mkdirSync(outDir, { recursive: true });

  return join(outDir, `${name}.pdf`);
}
