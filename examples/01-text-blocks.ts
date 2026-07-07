/**
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * Focus: style override, automatic word-wrap, auto page-break, image auto-scale
 * + text shorthand: a plain string or an object without `type` is a text node (no need for `type: 'text'`)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport } from '../src/index';
import type { ReportNodeInput } from '../src/index';
import { fontConfig, saveReport } from './shared';

/**
 * 240x150 cartoon gecko PNG — "kapom" (กะปอม) is Isan Thai for gecko/lizard, so this stands in
 * for the library's mascot/logo to demo addImage() + auto-scale to contentWidth
 */
const KAPOM_MASCOT_PNG_BASE64 =
  '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';

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
    data: KAPOM_MASCOT_PNG_BASE64,
    format: 'PNG',
    width: 400, // intentionally exceeds contentWidth (~180mm) → auto-scales down, keeping aspect ratio
    height: 250, // matches the source PNG's 240x150 (8:5) aspect ratio so the scaled-down box isn't stretched
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
