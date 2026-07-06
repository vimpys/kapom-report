import type { jsPDF } from 'jspdf';

/**
 * Wraps lines using real jsPDF (splitTextToSize reads the doc's current fontSize)
 * always sets/restores fontSize around the call — must never leave a side effect on the doc
 */
export function splitTextLines(
  doc: jsPDF,
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const previousSize = doc.getFontSize();
  doc.setFontSize(fontSize);
  // jspdf declares the return type as any → accept as unknown, then narrow
  const split: unknown = doc.splitTextToSize(text, maxWidth);
  doc.setFontSize(previousSize);
  return Array.isArray(split) ? (split as string[]) : [text];
}

/** height per line in the doc's units — fontSize is always in pt, must divide by scaleFactor to convert units */
export function lineHeightOf(doc: jsPDF, fontSize: number): number {
  return (fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
}

/** total height of a text block — single source of truth used by both measure and render */
export function measureTextBlockHeight(
  doc: jsPDF,
  text: string,
  fontSize: number,
  maxWidth: number,
): number {
  const lines = splitTextLines(doc, text, fontSize, maxWidth);
  return lines.length * lineHeightOf(doc, fontSize);
}
