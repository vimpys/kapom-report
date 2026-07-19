/**
 * File 3 of 3 — the runner.
 * A theme is report-wide (resolved once per report), so each theme is its own report → its own PDF.
 * Every report shares the exact same body from buildThemedCatalog — only the theme changes.
 * The loop renders one PDF per built-in preset; the custom object (layer 3) comes last.
 *
 * Run with: `tsx examples/03-theme/index.ts`
 */
import type { Theme, ThemeName } from '../../src/index';
import { outPath } from '../shared';
import { catalogSales } from './data';
import { buildThemedCatalog } from './report-template';

// layer 2 — the 9 built-in presets (strong: blue/green/graphite/wine/amber, pastel: rose/lavender/aqua/stone)
const presets: ThemeName[] = ['blue', 'green', 'graphite', 'wine', 'amber', 'rose', 'lavender', 'aqua', 'stone'];
for (const preset of presets) {
  const report = buildThemedCatalog(catalogSales, `theme: '${preset}'`, preset);
  report.save(outPath(`03-theme-${preset}`));
  console.log(`OK 03-theme-${preset}.pdf (${report.doc.getNumberOfPages()} pages)`);
}

// layer 3 — a custom object: only primary + bandFill are required (text colours auto-pick by luminance)
const custom: Theme = { primary: [76, 40, 130], bandFill: [232, 224, 246], zebraFill: [245, 241, 251] };
const customReport = buildThemedCatalog(catalogSales, 'theme: { primary, bandFill, zebraFill } — a custom object', custom);
customReport.save(outPath('03-theme-custom'));
console.log(`OK 03-theme-custom.pdf (${customReport.doc.getNumberOfPages()} pages)`);
