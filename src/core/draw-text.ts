import type { jsPDF, TextOptionsLight } from 'jspdf';
import { assertThaiRenderable } from './font-guard';
import { normalizeText } from './text-normalizer';
import type { TextNormalizeOptions } from './text-normalizer';
import type { TextStyle } from '../types/primitives';

/**
 * Sets the doc's fontSize/font/color from a TextStyle — a single place replacing the pattern
 * that used to be duplicated in text-block/signature-block/anchor/group band (it was once the
 * source of a color-bleed bug in demo 06); fontFamily unset = use the doc's current font,
 * color unset = keep the current color (a caller that always wants a black default should
 * pass `color: style.color ?? [0, 0, 0]` itself)
 */
export function applyTextStyle(doc: jsPDF, style: TextStyle): void {
  doc.setFontSize(style.fontSize);
  doc.setFont(style.fontFamily ?? doc.getFont().fontName, style.fontStyle ?? 'normal');
  if (style.color) {
    const [r, g, b] = style.color;
    doc.setTextColor(r, g, b);
  }
}

/**
 * The only place allowed to call doc.text() directly (a facade pattern, per decision) —
 * every block must draw text through this instead, so normalizeText is always guaranteed
 * regardless of whether the caller remembered to normalize beforehand (defense-in-depth at
 * the boundary) + fails fast if Thai text is about to be drawn with a built-in font that has no Thai glyphs
 */
export function drawText(
  doc: jsPDF,
  text: string | string[],
  x: number,
  y: number,
  options?: TextNormalizeOptions,
  textOptions?: TextOptionsLight,
): void {
  const normalized = Array.isArray(text)
    ? text.map((line) => normalizeText(line, options))
    : normalizeText(text, options);
  for (const line of Array.isArray(normalized) ? normalized : [normalized]) {
    assertThaiRenderable(doc, line);
  }

  // keep the 3-arg call shape when no text options are given (nearly every caller) so nothing changes for them
  if (textOptions) {
    doc.text(normalized, x, y, textOptions);
  } else {
    doc.text(normalized, x, y);
  }
}
