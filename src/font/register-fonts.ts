import type { jsPDF } from 'jspdf';
import { KapomFontError } from '../core/errors';
import type { FontConfig, FontSource } from './font-config';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function isValidBase64(value: string): boolean {
  return value.length > 0 && value.length % 4 === 0 && BASE64_PATTERN.test(value);
}

/** btoa/atob are globals in both the browser and Node >=18 — avoiding Buffer lets the lib run on both */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK_SIZE = 0x8000; // avoids a call stack overflow with large font files
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function toBase64(data: FontSource['data']): string {
  return typeof data === 'string' ? data : uint8ArrayToBase64(data);
}

/** the VFS filename must be unique per family+style, to prevent overwrites when a family has multiple weights */
function vfsFilename(font: FontSource): string {
  return `${font.family}-${font.style ?? 'normal'}.ttf`;
}

function validateFontConfig(config: FontConfig): void {
  if (config.fonts.length === 0) {
    throw new KapomFontError('FontConfig.fonts must contain at least 1 font');
  }

  const families = new Set(config.fonts.map((font) => font.family));

  if (config.defaultFamily !== undefined && !families.has(config.defaultFamily)) {
    throw new KapomFontError(
      `FontConfig.defaultFamily '${config.defaultFamily}' is not one of the registered fonts (${[...families].join(', ')})`,
    );
  }

  for (const font of config.fonts) {
    if (font.family.trim() === '') {
      throw new KapomFontError('FontSource.family must not be empty');
    }

    if (typeof font.data === 'string' && !isValidBase64(font.data)) {
      throw new KapomFontError(
        `FontSource '${font.family}': data is not valid base64 (check for a leftover data URI prefix)`,
      );
    }
  }
}

/**
 * Registers fonts into the doc's VFS — must be called before the first block renders (VFS timing)
 * returns the resolved default font family (defaultFamily, or fonts[0] as a fallback)
 */
export function registerFonts(doc: jsPDF, config: FontConfig): string {
  validateFontConfig(config);

  for (const font of config.fonts) {
    const filename = vfsFilename(font);
    doc.addFileToVFS(filename, toBase64(font.data));
    doc.addFont(filename, font.family, font.style ?? 'normal');
  }

  return config.defaultFamily ?? config.fonts[0].family;
}
