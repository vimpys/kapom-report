/**
 * File 1 of 3 — raw data.
 * The page's textual content — a heading, a caption, a body paragraph, and the overflow lines
 * used to demonstrate automatic page-breaks. Volume data (the 60 numbered lines) is generated,
 * per project convention: generation is fine when the point is volume, not content.
 */

export interface ArticleContent {
  heading: string;
  caption: string;
  body: string;
  overflowNote: string;
  overflowLines: string[];
}

const paragraph =
  "Sample text for testing the PdfCursor engine's automatic word wrap. When a line does not fit the available width, the engine computes the real line count via jsPDF's splitTextToSize and advances the cursor by the measured height. ";

export const article: ArticleContent = {
  heading: 'Text / Spacer / Divider / Image',
  caption: 'Gray text at fontSize 10 — style override on top of DEFAULT_TEXT_STYLE',
  body: paragraph.repeat(3),
  overflowNote:
    'Testing auto page-break: the repeated lines below will overflow onto the next page automatically',
  overflowLines: Array.from(
    { length: 60 },
    (_, i) => `Test line ${i + 1} — RenderEngine starts a new page on its own when space runs out`,
  ),
};
