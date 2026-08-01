import type { jsPDF } from 'jspdf';
import { KapomFontError } from './errors';

/** the standard 14 fonts built into jsPDF — definitely have no Thai glyphs */
const BUILTIN_STANDARD_FONTS = new Set(['helvetica', 'courier', 'times', 'symbol', 'zapfdingbats']);

/** Thai block U+0E00-U+0E7F — covers consonants/vowels/tone marks/Thai digits */
const THAI_CHAR = /[\u0E00-\u0E7F]/;

export function containsThai(text: string): boolean {
  return THAI_CHAR.test(text);
}

/** a font that ships with jsPDF itself (as opposed to a font the user registered via addFont) */
export function isBuiltinStandardFont(fontName: string): boolean {
  return BUILTIN_STANDARD_FONTS.has(fontName.toLowerCase());
}

export function thaiGlyphError(fontName: string, sample: string): KapomFontError {
  const preview = sample.length > 40 ? `${sample.slice(0, 40)}…` : sample;
  return new KapomFontError(
    `Thai text ("${preview}") is about to be rendered with '${fontName}', a jsPDF built-in font ` +
      `with no Thai glyphs — the output would be garbled without any error from jsPDF itself. ` +
      `Register a Thai font through the report's font config (e.g. Sarabun), or change the text ` +
      `to a language the font supports.`,
  );
}

/**
 * Fail fast against silent mojibake: Thai text + a jsPDF built-in font
 * always garbles silently — throw with a fix instead, per the fail-fast font validation
 * decision; a font the user registered is assumed to support it (checking real glyph
 * coverage would mean parsing a TTF's cmap table — too expensive for a guard that runs on every draw)
 */
export function assertThaiRenderable(doc: jsPDF, text: string): void {
  if (!containsThai(text)) return;
  const fontName = doc.getFont().fontName;
  if (!isBuiltinStandardFont(fontName)) return;
  throw thaiGlyphError(fontName, text);
}
