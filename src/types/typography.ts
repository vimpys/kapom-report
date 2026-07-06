import type { DeepPartial, TextStyle } from './primitives';

/**
 * Font sizing is a theme-level token per row-type, not set field-by-field — change the whole
 * report in one place. pageHeaderFooter/reportTitle/reportSubtitle/sectionHeading await a block
 * that actually uses them, added in step 6 (Composite Report).
 */
export interface Typography {
  reportTitle: TextStyle;
  reportSubtitle: TextStyle;
  sectionHeading: TextStyle;
  columnHeader: TextStyle;
  detailRow: TextStyle;
  groupHeader: TextStyle;
  groupFooter: TextStyle;
  summary: TextStyle;
  pageHeaderFooter: TextStyle;
}

export const DEFAULT_TYPOGRAPHY: Typography = {
  reportTitle: { fontSize: 18, fontStyle: 'bold' },
  reportSubtitle: { fontSize: 11, fontStyle: 'normal', color: [100, 100, 100] },
  sectionHeading: { fontSize: 13, fontStyle: 'bold' },
  columnHeader: { fontSize: 10, fontStyle: 'bold', color: [255, 255, 255] },
  detailRow: { fontSize: 10, fontStyle: 'normal' },
  groupHeader: { fontSize: 10, fontStyle: 'bold' },
  groupFooter: { fontSize: 10, fontStyle: 'bold' },
  summary: { fontSize: 10, fontStyle: 'bold', color: [255, 255, 255] },
  pageHeaderFooter: { fontSize: 8, fontStyle: 'normal', color: [120, 120, 120] },
};

const TOKEN_NAMES = Object.keys(DEFAULT_TYPOGRAPHY) as (keyof Typography)[];

/** Merge one token at a time — precedence: override token → DEFAULT_TYPOGRAPHY token (never merges across tokens) */
export function resolveTypography(override?: DeepPartial<Typography>): Typography {
  if (!override) return DEFAULT_TYPOGRAPHY;

  const resolved = {} as Typography;
  for (const name of TOKEN_NAMES) {
    const base = DEFAULT_TYPOGRAPHY[name];
    const partial = override[name];
    resolved[name] = partial ? { ...base, ...partial } : base;
  }
  return resolved;
}
