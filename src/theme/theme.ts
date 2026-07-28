import { KapomError } from '../core/errors';
import type { RGB } from '../types/primitives';

/**
 * A ready-made colour scheme for a report. A theme drives the *fills* of every table surface
 * (header, group band, subtotal/summary foot, grand total, nested master-detail, zebra) plus the
 * text colour that sits on each fill. Everything else (per-node `style.header`/`style.footer`/
 * `style.zebra`, `TextStyle.color`, box/divider colours) still overrides the theme — precedence is
 * always per-node override > theme > built-in default.
 *
 * Only `primary` + `bandFill` are required; the rest derive:
 * - `onPrimary`/`onBand` default to black or white by luminance (readable on the fill).
 * - `zebraFill` omitted = no zebra (the default look).
 * Keep `primary` dark and `bandFill` light so the auto-picked text stays readable.
 */
export interface Theme {
  /** strong brand fill — column header, subtotal/summary foot, grand total */
  primary: RGB;
  /** light tint — group band, column-group super-header sits on the header fill, nested tints */
  bandFill: RGB;
  /** text on `primary` — omit to auto-pick black/white by luminance */
  onPrimary?: RGB;
  /** text on `bandFill` — omit to auto-pick */
  onBand?: RGB;
  /** alternating body-row fill — omit = no zebra */
  zebraFill?: RGB;
}

/** every table colour slot resolved to a concrete value (nested tints derived from the palette) */
export interface ResolvedTheme {
  readonly primary: RGB;
  readonly onPrimary: RGB;
  readonly bandFill: RGB;
  readonly onBand: RGB;
  /** undefined = no default zebra (tables show it only when the node sets `style.zebra`) */
  readonly zebraFill: RGB | undefined;
  readonly nestedIdentityFill: RGB;
  readonly nestedIdentityText: RGB;
  readonly nestedChildFill: RGB;
  readonly nestedChildText: RGB;
}

export type ThemeName =
  | 'blue'
  | 'green'
  | 'graphite'
  | 'wine'
  | 'amber'
  | 'rose'
  | 'lavender'
  | 'aqua'
  | 'stone';
export type ThemeInput = ThemeName | Theme;

/**
 * The colours in effect when no theme is chosen — identical to the values the library used before
 * themes existed (AutoTable's blue header/foot, the grey group band, the light-blue stacked tints,
 * no zebra). `resolveTheme(undefined)` returns exactly this, so existing reports don't change.
 */
export const DEFAULT_RESOLVED_THEME: ResolvedTheme = {
  primary: [41, 128, 185],
  onPrimary: [255, 255, 255],
  bandFill: [236, 240, 241],
  onBand: [0, 0, 0],
  zebraFill: undefined,
  nestedIdentityFill: [233, 241, 249],
  nestedIdentityText: [22, 50, 79],
  nestedChildFill: [231, 237, 243],
  nestedChildText: [51, 69, 92],
};

/** built-in presets — each is a minimal `Theme`; `resolveTheme` fills in the derived slots */
export const THEME_PRESETS: Record<ThemeName, Theme> = {
  // strong presets — dark primary, white text
  blue: { primary: [41, 128, 185], bandFill: [236, 240, 241] },
  green: { primary: [47, 93, 63], bandFill: [214, 232, 218], zebraFill: [237, 246, 238] },
  graphite: { primary: [55, 58, 64], bandFill: [230, 231, 234] },
  wine: { primary: [120, 36, 62], bandFill: [240, 220, 227], zebraFill: [249, 240, 243] },
  amber: { primary: [140, 90, 20], bandFill: [250, 238, 214], zebraFill: [252, 247, 236] },
  // pastel presets — light primary, so auto-contrast picks dark text (a softer look)
  rose: { primary: [223, 150, 180], bandFill: [250, 230, 240], zebraFill: [252, 243, 247] },
  lavender: { primary: [178, 160, 216], bandFill: [238, 232, 249], zebraFill: [245, 241, 251] },
  aqua: { primary: [140, 200, 205], bandFill: [226, 243, 244], zebraFill: [239, 248, 248] },
  stone: { primary: [150, 155, 165], bandFill: [234, 235, 238] },
};

/**
 * Every colour a caller hands in is checked and copied. Checked because an out-of-range or
 * non-numeric channel doesn't fail anywhere downstream — jsPDF clamps it, so the report just comes
 * out the wrong colour, which is the kind of thing you only notice after printing; the rest of the
 * library already fails fast on bad config (an unknown preset name right below, margins, watermark
 * opacity), so this was the odd one out. Copied because `RGB` is readonly only to *us*: the caller
 * still holds the array they passed and could mutate it later, silently changing a theme that was
 * meant to be resolved once for the whole report.
 */
function checkedColor(value: RGB, field: string): RGB {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new KapomError(`theme.${field} must be an [r, g, b] tuple of 3 numbers`);
  }
  for (const channel of value) {
    if (typeof channel !== 'number' || !Number.isFinite(channel) || channel < 0 || channel > 255) {
      throw new KapomError(
        `theme.${field} must be 3 numbers between 0 and 255 (got [${value.join(', ')}])`,
      );
    }
  }
  const [r, g, b] = value;
  return [r, g, b];
}

/** relative luminance (0..1) of an sRGB colour — used to pick readable text on a fill */
function luminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** black on a light fill, white on a dark one */
function autoContrast(fill: RGB): RGB {
  return luminance(fill) > 0.55 ? [0, 0, 0] : [255, 255, 255];
}

/**
 * name → preset, object → used directly; fills in `onPrimary`/`onBand` (auto-contrast) and the
 * nested tints (reuse the band identity for one coherent look). No input = DEFAULT_RESOLVED_THEME
 * (backward compatible). An unknown preset name throws, like the other fail-fast registries.
 */
export function resolveTheme(input?: ThemeInput): ResolvedTheme {
  if (input === undefined) return DEFAULT_RESOLVED_THEME;

  let theme: Theme;
  if (typeof input === 'string') {
    const preset = THEME_PRESETS[input];
    if (!preset) {
      throw new KapomError(
        `unknown theme '${input}' — expected one of: ${Object.keys(THEME_PRESETS).join(', ')}`,
      );
    }
    theme = preset;
  } else {
    theme = input;
  }

  const primary = checkedColor(theme.primary, 'primary');
  const bandFill = checkedColor(theme.bandFill, 'bandFill');
  const onPrimary = theme.onPrimary ? checkedColor(theme.onPrimary, 'onPrimary') : autoContrast(primary);
  const onBand = theme.onBand ? checkedColor(theme.onBand, 'onBand') : autoContrast(bandFill);
  const zebraFill = theme.zebraFill ? checkedColor(theme.zebraFill, 'zebraFill') : undefined;

  return {
    primary,
    onPrimary,
    bandFill,
    onBand,
    zebraFill,
    // nested master-detail tints reuse the band identity for a coherent single-theme look
    nestedIdentityFill: bandFill,
    nestedIdentityText: onBand,
    nestedChildFill: bandFill,
    nestedChildText: onBand,
  };
}
