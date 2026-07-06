/**
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * Focus: style override, automatic word-wrap, auto page-break, image auto-scale
 * + text shorthand: a plain string or an object without `type` is a text node (no need for `type: 'text'`)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport } from '../src/index';
import type { ReportNodeInput } from '../src/index';
import { fontConfig, saveReport } from './shared';

/** 1x1 transparent PNG — stands in for a real logo to demo addImage() + auto-scale to contentWidth */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

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
    data: TINY_PNG_BASE64,
    format: 'PNG',
    width: 400, // intentionally exceeds contentWidth (~180mm) → auto-scales down, keeping aspect ratio
    height: 400,
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
