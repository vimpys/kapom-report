/**
 * File 2 of 3 — the report template.
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * Focus: style override, automatic word-wrap, auto page-break, image auto-scale
 * + text shorthand: a plain string or an object without `type` is a text node (no need for
 * `type: 'text'`). Assembled with the `reportBuilder()` chain — a free-form page is just
 * `.content(...blocks)`, no table required.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportBuilder } from '../../src/index';
import type { KapomReport, ReportNodeInput } from '../../src/index';
import { fontConfig } from '../shared';
import type { ArticleContent } from './data';

/** "kapom" (กะปอม) is Isan Thai for gecko/lizard — the library's actual logo, used as the sample image */
const here = dirname(fileURLToPath(import.meta.url));
const logoData = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

export function buildTextAndLayout(article: ArticleContent): KapomReport {
  const blocks: ReportNodeInput[] = [
    // text shorthand: an object without `type` is a text node
    { content: article.heading, style: { fontSize: 18, fontStyle: 'bold' } },
    { type: 'spacer', height: 4 },
    { content: article.caption, style: { fontSize: 10, color: [100, 100, 100] } },
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
    article.body, // text shorthand: a plain string is a text node
    { type: 'spacer', height: 10 },
    { type: 'divider', thickness: 1, color: [200, 0, 0] },
    { type: 'spacer', height: 4 },
    { content: article.overflowNote, style: { fontStyle: 'bold' } },
    ...article.overflowLines,
  ];

  return reportBuilder().font(fontConfig).content(...blocks).build();
}
