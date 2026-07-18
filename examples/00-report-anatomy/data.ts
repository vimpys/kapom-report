/**
 * File 1 of 3 — the anatomy map as data.
 * Each row is one region of a report paired with the reportBuilder() method that produces it.
 * The template below renders these rows AS a report — so the document you get is itself an example
 * of every region it describes.
 */

export interface AnatomyRow {
  region: string;
  method: string;
  when: string;
  layer: 'frame' | 'content' | 'setup';
}

export const anatomy: AnatomyRow[] = [
  { region: 'Page header', method: '.pageHeader.addBlock()', when: 'Every page (reserves space)', layer: 'frame' },
  { region: 'Title', method: '.title()', when: 'Once — first page, under the header', layer: 'content' },
  { region: 'Content', method: '.content()', when: 'Flows and paginates', layer: 'content' },
  { region: 'Summary', method: '.summary()', when: 'Once — pinned to the bottom', layer: 'content' },
  { region: 'Page footer', method: '.pageFooter.addBlock()', when: 'Every page', layer: 'frame' },
  { region: 'Page number', method: '.pageNumber()', when: 'Every page — drawn in the margin', layer: 'frame' },
  { region: 'Settings', method: '.font() / .pageSetup()', when: 'Set once, up front', layer: 'setup' },
];

/** short paragraphs, one per region — printed as the "in detail" section (also fills a second page) */
export const detail: ReadonlyArray<readonly [string, string]> = [
  ['Page header', 'The band at the very top of this page — logo and report name. It is part of the page frame: it reprints on every page and reserves height, so content never overlaps it.'],
  ['Title', 'The large "Report Anatomy" heading. It is the first block of content, printed once on the first page. Note where it sits: directly under the page header, not at the very top of the sheet — the frame always sits above the content.'],
  ['Content', 'This body — the map table, these paragraphs — is content. It flows top to bottom and breaks across pages on its own when a report runs long.'],
  ['Summary', 'The line pinned at the bottom of the last page. Use it for a signature or a grand total: it is pushed to the page bottom rather than flowing right after the content above it.'],
  ['Page footer + number', 'The footer band and the "Page X of Y" annotation at the bottom. Both belong to the frame and reprint every page; the number is drawn inside the margin, so it costs no content space.'],
  ['Settings', 'Font, paper size, and margins are set once at the start and apply to the whole document — they are configuration, not a region you see.'],
];
