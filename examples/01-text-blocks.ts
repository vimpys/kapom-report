/**
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * Focus: style override, automatic word-wrap, auto page-break, image auto-scale
 * + text shorthand: a plain string or an object without `type` is a text node (no need for `type: 'text'`)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKapomReport } from '../src/index';
import type { ReportNodeInput } from '../src/index';
import { fontConfig, saveReport } from './shared';

/** "kapom" (กะปอม) is Isan Thai for gecko/lizard — the library's actual logo, used as the sample image */
const here = dirname(fileURLToPath(import.meta.url));
const logoData = new Uint8Array(readFileSync(join(here, '../src/assets/kapom-report.png')));

const paragraph =
  'Sample text for testing the PdfCursor engine\'s automatic word wrap. When a line does not fit the available width, the engine computes the real line count via jsPDF\'s splitTextToSize and advances the cursor by the measured height. ';

const blocks: ReportNodeInput[] = [
  // text shorthand: an object without `type` is a text node
  { content: 'Text / Spacer / Divider / Image', style: { fontSize: 18, fontStyle: 'bold' } },
  { type: 'spacer', height: 4 },
  {
    content: 'Gray text at fontSize 10 — style override on top of DEFAULT_TEXT_STYLE',
    style: { fontSize: 10, color: [100, 100, 100] },
  },
  { type: 'spacer', height: 6 },
  { type: 'divider' },
  { type: 'spacer', height: 6 },
  {
    type: 'image',
    data: logoData,
    format: 'PNG',
    width: 400, // intentionally exceeds contentWidth (~180mm) → auto-scales down, keeping aspect ratio
    height: 400, // matches the source PNG's 1254x1254 (1:1) aspect ratio so the scaled-down box isn't stretched
  },
  { type: 'spacer', height: 6 },
  paragraph.repeat(3), // text shorthand: a plain string is a text node
  { type: 'spacer', height: 10 },
  { type: 'divider', thickness: 1, color: [200, 0, 0] },
  { type: 'spacer', height: 4 },
  {
    content: 'Testing auto page-break: the repeated lines below will overflow onto the next page automatically',
    style: { fontStyle: 'bold' },
  },
  ...Array.from(
    { length: 60 },
    (_, i) => `Test line ${i + 1} — RenderEngine starts a new page on its own when space runs out`,
  ),
];

saveReport(createKapomReport({ blocks, font: fontConfig }), '01-text-blocks');
