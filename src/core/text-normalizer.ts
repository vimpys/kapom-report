/**
 * Enforced on every piece of text before it reaches jsPDF (decision in CLAUDE.md) — jsPDF
 * computes width glyph-by-glyph directly, so stray control/whitespace characters break
 * layout (wrong widths, wrapping in the wrong place, or drawing as boxes) with no visible error.
 */
export interface TextNormalizeOptions {
  /** NBSP (U+00A0, U+202F) -> a regular space; can be disabled if intentionally used to prevent number wrapping — default true */
  collapseNbsp?: boolean;
  /** number of spaces per tab (jsPDF doesn't know about tab stops) — default 4 */
  tabWidth?: number;
}

// Built via RegExp(string) rather than a literal directly — this keeps an editor/encoding from
// turning the escapes into real unicode characters in the source file (zero-width/bidi
// characters shouldn't exist as literal characters in the code).
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\u2060]', 'g');
const BIDI_MARKS = new RegExp('[\\u200E\\u200F\\u202A-\\u202E]', 'g');
const BOM = new RegExp('[\\uFEFF]', 'g');
const CONTROL_CHARS_EXCEPT_NEWLINE = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F]', 'g');
const NBSP = new RegExp('[\\u00A0\\u202F]', 'g');

/**
 * Thai combining marks (vowels/tone marks) are not stripped — they depend on correct font
 * shaping (tied to the font registry in ../font), not something the normalizer can fix.
 */
export function normalizeText(text: string, options: TextNormalizeOptions = {}): string {
  const tabWidth = options.tabWidth ?? 4;
  const collapseNbsp = options.collapseNbsp ?? true;

  let result = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' '.repeat(tabWidth))
    .replace(ZERO_WIDTH, '')
    .replace(BIDI_MARKS, '')
    .replace(BOM, '')
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, '');

  if (collapseNbsp) {
    result = result.replace(NBSP, ' ');
  }

  return result;
}
