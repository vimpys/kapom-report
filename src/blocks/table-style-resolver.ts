import type { FontStyle as AutoTableFontStyle, Styles } from 'jspdf-autotable';
import type { RenderContext } from '../core/context';
import { cellStyleToAutoTableStyles, partialTextStyleToAutoTableStyles } from '../table/autotable-styles';
import type { TableStyleOptions } from '../types/node';
import type { CellStyle, TextStyle } from '../types/primitives';

/**
 * Resolves a table's Typography tokens + per-table style overrides + theme into the `Partial<Styles>`
 * AutoTable understands — the render-time style layer of TableBlock, split out so the block itself
 * stays focused on layout/pagination. Every method that maps a fontStyle runs it through the
 * fontStyle-variant guard, so a font missing the requested variant silently falls back to 'normal'
 * instead of jsPDF warning and dropping it. Holds the table's `style` (header/footer/zebra overrides);
 * everything else it needs (doc/theme/typography) comes from the RenderContext per call.
 */
export class TableStyleResolver<T> {
  constructor(private readonly style: TableStyleOptions<T> | undefined) {}

  /**
   * Every one of AutoTable's built-in themes sets head/foot to 'bold' by default — if the font
   * in use doesn't have that variant registered, jsPDF warns silently and falls back (the exact
   * silent failure the font decision says we must guard against ourselves); always checks
   * getFontList first before using it.
   */
  resolveSupportedFontStyle<S extends AutoTableFontStyle>(
    doc: RenderContext['doc'],
    fontName: string,
    requested: S | undefined,
  ): S | 'normal' {
    if (!requested || requested === 'normal') return 'normal';
    const available = doc.getFontList()[fontName] ?? [];

    return available.includes(requested) ? requested : 'normal';
  }

  /** replace styles.fontStyle with 'normal' if the font in use lacks that variant (mutates in place) — shared by token/head style resolution */
  guardFontStyle(ctx: RenderContext, styles: Partial<Styles>): void {
    if (!styles.fontStyle) return;
    const fontName = styles.font ?? ctx.doc.getFont().fontName;
    styles.fontStyle = this.resolveSupportedFontStyle(ctx.doc, fontName, styles.fontStyle);
  }

  /** Typography token → AutoTable styles with a fontStyle fallback if the font in use doesn't actually have that variant */
  resolveTokenStyles(ctx: RenderContext, token: TextStyle): Partial<Styles> {
    const styles = partialTextStyleToAutoTableStyles(token);
    this.guardFontStyle(ctx, styles);

    return styles;
  }

  /** merge an optional CellStyle override over a base style through the fontStyle-variant guard — shared by the symmetric head/foot resolvers */
  applyStyleOverride(
    ctx: RenderContext,
    base: Partial<Styles>,
    override: Partial<CellStyle> | undefined,
  ): Partial<Styles> {
    if (!override) return base;
    const merged = { ...base, ...cellStyleToAutoTableStyles(override) };
    this.guardFontStyle(ctx, merged);

    return merged;
  }

  /**
   * head section = Typography.columnHeader token + TableStyleOptions.header override (e.g. a
   * brand fillColor — without it the head keeps AutoTable's theme default); the override goes
   * through the same fontStyle-variant guard as the token
   */
  resolveHeadStyles(ctx: RenderContext): Partial<Styles> {
    // header cells default to vertically centered (matters for a rowSpan cell in a grouped head;
    // harmless for a single-row header) — applies to the whole head section, overridable per cell.
    // the theme drives the fill + on-fill text (primary/onPrimary); style.header still overrides
    const base: Partial<Styles> = {
      valign: 'middle',
      ...this.resolveTokenStyles(ctx, ctx.typography.columnHeader),
      fillColor: [...ctx.theme.primary],
      textColor: [...ctx.theme.onPrimary],
    };

    return this.applyStyleOverride(ctx, base, this.style?.header);
  }

  /** foot styles = the foot token + theme primary fill / on-primary text, then an optional per-table `style.footer` override (symmetric with resolveHeadStyles) */
  resolveFootStyles(ctx: RenderContext, footToken: TextStyle): Partial<Styles> {
    const base: Partial<Styles> = {
      ...this.resolveTokenStyles(ctx, footToken),
      fillColor: [...ctx.theme.primary],
      textColor: [...ctx.theme.onPrimary],
    };

    return this.applyStyleOverride(ctx, base, this.style?.footer);
  }

  /** the node's style with the theme's default zebra filled in — only when the node itself sets no zebra (a node's own `style.zebra` always wins) */
  effectiveStyle(ctx: RenderContext): TableStyleOptions<T> | undefined {
    const style = this.style;
    const zebraFill = ctx.theme.zebraFill;
    if (!zebraFill || style?.zebra) return style;

    return { ...style, zebra: { even: zebraFill } };
  }
}
