/** jsPDF's setFont accepts these as fontStyle when drawing (a different set from primitives.FontStyle, which has no bolditalic) */
export type FontVariantStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface FontSource {
  family: string;
  /** font file data (.ttf) — base64 (no data URI prefix) or binary */
  data: string | Uint8Array;
  /** default 'normal' — must match the fontStyle actually used everywhere in the report */
  style?: FontVariantStyle;
}

export interface FontConfig {
  /** a non-empty tuple — enforces at least 1 entry at the type level, so fonts[0] is type-safe */
  fonts: readonly [FontSource, ...FontSource[]];
  /** optional → falls back to fonts[0].family if unset (option B, prevents a silent helvetica fallback) */
  defaultFamily?: string;
}
