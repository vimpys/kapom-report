import { autoTable } from 'jspdf-autotable';
import type { FontStyle as AutoTableFontStyle, Styles, UserOptions } from 'jspdf-autotable';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { applyTextStyle, drawText } from '../core/draw-text';
import { KapomError } from '../core/errors';
import { containsThai, isBuiltinStandardFont, thaiGlyphError } from '../core/font-guard';
import { lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import { resolveRowStyle } from '../style/resolve-cell-style';
import {
  createSegmentState,
  DEFAULT_NO_DATA_TEXT,
  DEFAULT_SUMMARY_LABEL,
  resolveAggregateRow,
  resolveTableContent,
  visibleColumns,
} from '../table/column-resolver';
import { computeColumnWidths } from '../table/column-width';
import type { GroupTreeNode } from '../table/group-tree';
import {
  buildGroupTree,
  countGroupBands,
  flattenGroupTreeRows,
} from '../table/group-tree';
import type { ReportColumn, ResolvedAlign } from '../types/column';
import { resolveColumnAlign } from '../types/column';
import type { GroupResolver, TableNode, TableStyleOptions } from '../types/node';
import type { CellStyle, RGB, TextStyle } from '../types/primitives';

/** row height ≈ line-height + AutoTable's top/bottom cellPadding — an approximate ratio */
const ESTIMATED_ROW_HEIGHT_RATIO = 1.9;
/** group header band height as a ratio of line-height */
const GROUP_BAND_HEIGHT_RATIO = 1.6;

/** the band/grand-total background is this composite pattern's own convention — not yet open to theme override (see CLAUDE.md) */
const GROUP_BAND_FILL: RGB = [236, 240, 241];
const GRAND_TOTAL_FILL: RGB = [41, 128, 185];

/** CellStyle (zebra/conditional override) → AutoTable Partial<Styles> */
function cellStyleToAutoTableStyles(style: Partial<CellStyle>): Partial<Styles> {
  const styles: Partial<Styles> = {};
  if (style.fillColor) styles.fillColor = [...style.fillColor];
  if (style.textColor) styles.textColor = [...style.textColor];
  if (style.fontStyle) styles.fontStyle = style.fontStyle;
  if (style.fontSize !== undefined) styles.fontSize = style.fontSize;
  if (style.halign) styles.halign = style.halign;
  return styles;
}

/** extracts a string from an AutoTable cell — handles both a plain string and a CellDef object ({content}, e.g. the no-data colSpan row) */
function cellStringContent(cell: unknown): string | undefined {
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'object' && cell !== null && 'content' in cell) {
    const { content } = cell as { content?: unknown };
    if (typeof content === 'string') return content;
  }
  return undefined;
}

/** TextStyle (a Typography token / column-level headerStyle/cellStyle) → AutoTable Partial<Styles> — font family isn't set unless specified (inherits from the base styles.font instead) */
function partialTextStyleToAutoTableStyles(style: Partial<TextStyle> | undefined): Partial<Styles> {
  if (!style) return {};
  const styles: Partial<Styles> = {};
  if (style.fontSize !== undefined) styles.fontSize = style.fontSize;
  if (style.fontStyle) styles.fontStyle = style.fontStyle;
  if (style.color) styles.textColor = [...style.color];
  if (style.fontFamily) styles.font = style.fontFamily;
  return styles;
}

export class TableBlock<T> implements MeasurableBlock {
  constructor(private readonly node: TableNode<T>) {
    if (node.nested) {
      throw new KapomError('nested tables are not supported yet — coming with group integration (roadmap)');
    }
  }

  /**
   * An estimate, not an exact figure — used only to decide whether to break before starting the
   * table (wrapping within cells / the real style is only known once AutoTable draws); a table
   * longer than a page already paginates itself within AutoTable, so the engine doesn't need to
   * know the real height.
   */
  measureHeight(ctx: MeasureContext): number {
    const fontSize = ctx.typography.detailRow.fontSize;
    const lineHeight = ctx.measureText('X', fontSize, ctx.contentWidth);
    const rowHeight = lineHeight * ESTIMATED_ROW_HEIGHT_RATIO;
    const footRows = this.hasAggregate() ? 1 : 0;

    // No-Data fallback: header + a single message row
    if (this.node.data.length === 0) return 2 * rowHeight;

    if (!this.node.group) {
      return (1 + this.node.data.length + footRows) * rowHeight;
    }

    // grouped: every group at every level has a band + subtotal (if there's an aggregate); a leaf segment has its own head
    // countGroupBands counts across every level of the subGroup chain (nested group, roadmap 10)
    const groupCount = countGroupBands(this.node.group, this.node.data);
    const bandHeight = lineHeight * GROUP_BAND_HEIGHT_RATIO;
    return (
      groupCount * (bandHeight + rowHeight + footRows * rowHeight) +
      this.node.data.length * rowHeight +
      footRows * rowHeight
    );
  }

  render(ctx: RenderContext): void {
    if (this.node.data.length === 0) {
      this.renderNoData(ctx);
      return;
    }
    if (this.node.group) {
      this.renderGrouped(ctx, this.node.group);
    } else {
      this.renderFlat(ctx);
    }
  }

  // ── No-Data fallback (empty data — review fix #5) ────────────────────────

  /** header + a single message row, colSpan across the full width — replaces the old silent empty header */
  private renderNoData(ctx: RenderContext): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const head = columns.map((col) => normalizeText(col.header));
    const text = normalizeText(this.node.noDataText ?? DEFAULT_NO_DATA_TEXT);

    this.runAutoTable(ctx, {
      head: [head],
      body: [[{ content: text, colSpan: columns.length, styles: { halign: 'center' } }]],
      headStyles: this.resolveTokenStyles(ctx, ctx.typography.columnHeader),
      bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
      didParseCell: this.alignHook(aligns),
    });
  }

  /**
   * columnStyles per index: halign + fixed width + column-level cellStyle — cellStyle must
   * always come before didParseCell (zebra/conditional apply later, so they can override it per the locked-in precedence)
   */
  private buildColumnStyles(
    aligns: readonly ResolvedAlign[],
    columns: readonly ReportColumn<T>[],
    widthOf: (index: number) => Partial<Styles>,
  ): Record<string, Partial<Styles>> {
    const columnStyles: Record<string, Partial<Styles>> = {};
    aligns.forEach((align, index) => {
      columnStyles[String(index)] = {
        halign: align.data,
        ...widthOf(index),
        ...partialTextStyleToAutoTableStyles(columns[index]?.cellStyle),
      };
    });
    return columnStyles;
  }

  // ── flat (ungrouped) ────────────────────────────────────────────────

  private renderFlat(ctx: RenderContext): void {
    const columns = visibleColumns(this.node.columns);
    const content = resolveTableContent(this.node, ctx.numeric);
    const columnStyles = this.buildColumnStyles(content.aligns, columns, (index) => {
      const width = content.widths[index];
      return width !== undefined ? { cellWidth: width } : {};
    });

    this.runAutoTable(ctx, {
      head: [content.head],
      body: content.body,
      ...(content.foot ? { foot: [content.foot] } : {}),
      columnStyles,
      headStyles: this.resolveTokenStyles(ctx, ctx.typography.columnHeader),
      bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
      footStyles: this.resolveTokenStyles(ctx, ctx.typography.summary),
      didParseCell: this.cellHook(content.aligns, columns, this.node.data, this.node.style),
    });
  }

  // ── grouped (composite: a band + segment per group + grand total; recursive when there's a subGroup) ──────

  private renderGrouped(ctx: RenderContext, resolver: GroupResolver<T>): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const head = columns.map((col) => normalizeText(col.header));
    const state = createSegmentState(columns.length);

    // a tree covering every level of the subGroup chain — a leaf has a body, a non-leaf has children (roadmap 10)
    const tree = buildGroupTree(columns, this.node.data, resolver, ctx.numeric, state);
    const grandFoot = resolveAggregateRow(
      columns,
      this.node.data,
      ctx.numeric,
      this.node.summaryLabel ?? DEFAULT_SUMMARY_LABEL,
    );

    // fix a single set of column widths from every group's content at every level — keeps the column lines aligned across segments
    const allRows: (readonly string[])[] = [
      head,
      ...flattenGroupTreeRows(tree),
      ...(grandFoot ? [grandFoot] : []),
    ];
    const widths = computeColumnWidths(
      ctx.doc,
      allRows,
      columns.map((col) => col.width),
      ctx.contentWidth,
      ctx.typography.detailRow.fontSize, // measured at the same fontSize the body actually uses (review fix #3)
    );

    const columnStyles = this.buildColumnStyles(aligns, columns, (index) => ({
      cellWidth: widths[index] ?? 'auto',
    }));

    const lineHeight = lineHeightOf(ctx.doc, ctx.typography.detailRow.fontSize);
    const bandHeight = lineHeight * GROUP_BAND_HEIGHT_RATIO;
    const rowEstimate = lineHeight * ESTIMATED_ROW_HEIGHT_RATIO;

    this.renderGroupTree(ctx, tree, {
      head,
      aligns,
      columns,
      columnStyles,
      bandHeight,
      rowEstimate,
    });

    if (grandFoot) {
      ctx.ensureSpace(rowEstimate);
      // the grand total is a single, boldly-styled body row — not AutoTable's own foot, because
      // a table with only a foot and no body is an edge case the library doesn't guarantee
      this.runAutoTable(ctx, {
        // The default theme ('striped') always sets alternateRow.fillColor for even body row
        // indexes (this row is the only one = index 0 = always even), which silently merges over
        // our bodyStyles.fillColor (observed while checking a real demo — the background faded to
        // gray instead of the intended blue). 'plain' doesn't define alternateRow at all as its
        // default, which sidesteps the problem entirely.
        theme: 'plain',
        body: [grandFoot],
        columnStyles,
        bodyStyles: {
          ...this.resolveTokenStyles(ctx, ctx.typography.summary),
          fillColor: [...GRAND_TOTAL_FILL],
        },
        didParseCell: this.alignHook(aligns),
      });
    }
  }

  /** the shared context passed down every level of renderGroupTree (computed once in renderGrouped) */
  private renderGroupTree(
    ctx: RenderContext,
    tree: readonly GroupTreeNode<T>[],
    shared: {
      head: string[];
      aligns: readonly ResolvedAlign[];
      columns: readonly ReportColumn<T>[];
      columnStyles: Record<string, Partial<Styles>>;
      bandHeight: number;
      rowEstimate: number;
    },
  ): void {
    for (const node of tree) {
      // keep-together: the band (+ any child bands nested below it) + head + the first N rows must all land on the same page
      ctx.ensureSpace(this.requiredSpaceFor(node, shared.bandHeight, shared.rowEstimate));
      this.drawGroupBand(ctx, node.label, shared.bandHeight, node.depth);

      if (node.children) {
        this.renderGroupTree(ctx, node.children, shared);
        // a non-leaf subtotal has no segment to attach a foot to — drawn as a separate single row instead
        if (node.foot) this.renderSubtotalRow(ctx, node.foot, shared);
        continue;
      }

      this.runAutoTable(ctx, {
        head: [shared.head],
        body: node.body ?? [],
        ...(node.foot ? { foot: [node.foot] } : {}),
        columnStyles: shared.columnStyles,
        headStyles: this.resolveTokenStyles(ctx, ctx.typography.columnHeader),
        bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
        footStyles: this.resolveTokenStyles(ctx, ctx.typography.groupFooter),
        didParseCell: this.cellHook(shared.aligns, shared.columns, node.rows, this.node.style),
      });
    }
  }

  /** minimum space needed before drawing this node's band — a non-leaf must account for the child bands nested down to the first leaf */
  private requiredSpaceFor(
    node: GroupTreeNode<T>,
    bandHeight: number,
    rowEstimate: number,
  ): number {
    const firstChild = node.children?.[0];
    if (firstChild) {
      return bandHeight + this.requiredSpaceFor(firstChild, bandHeight, rowEstimate);
    }
    const bodyRows = node.body?.length ?? 0;
    return bandHeight + rowEstimate + Math.min(node.minRowsWithHeader, bodyRows) * rowEstimate;
  }

  /**
   * a non-leaf group's subtotal (nested group) — a single row with theme 'plain', for the same
   * reason as the grand total (a foot-only table is an edge case AutoTable doesn't guarantee,
   * and it avoids alternateRow overriding fillColor); uses the same GROUP_BAND_FILL background
   * as the band, to visually pair with the group's header, unlike the grand total's darker color
   */
  private renderSubtotalRow(
    ctx: RenderContext,
    foot: string[],
    shared: { aligns: readonly ResolvedAlign[]; columnStyles: Record<string, Partial<Styles>>; rowEstimate: number },
  ): void {
    ctx.ensureSpace(shared.rowEstimate);
    this.runAutoTable(ctx, {
      theme: 'plain',
      body: [foot],
      columnStyles: shared.columnStyles,
      bodyStyles: {
        ...this.resolveTokenStyles(ctx, ctx.typography.groupFooter),
        fillColor: [...GROUP_BAND_FILL],
      },
      didParseCell: this.alignHook(shared.aligns),
    });
  }

  private drawGroupBand(ctx: RenderContext, label: string, bandHeight: number, depth = 0): void {
    const { doc, cursor, contentWidth } = ctx;
    const token = ctx.typography.groupHeader;
    const [r, g, b] = GROUP_BAND_FILL;
    doc.setFillColor(r, g, b);
    doc.rect(cursor.x, cursor.y, contentWidth, bandHeight, 'F');

    const fontName = token.fontFamily ?? doc.getFont().fontName;
    applyTextStyle(doc, {
      ...token,
      fontStyle: this.resolveSupportedFontStyle(doc, fontName, token.fontStyle),
      color: token.color ?? [0, 0, 0], // a band must always get the default black — never inherit color from the previous block
    });

    const inset = 5 / doc.internal.scaleFactor; // mirrors AutoTable's cellPadding
    // nested group: indent the label according to depth, to make the hierarchy visible (bands are the same full width at every level)
    const indent = inset * 2 * depth;
    const lineHeight = lineHeightOf(doc, token.fontSize);
    drawText(doc, label, cursor.x + inset + indent, cursor.y + lineHeight * 1.15);

    ctx.advanceY(bandHeight);
  }

  // ── style resolution ──────────────────────────────────────────────────

  /** Typography token → AutoTable styles with a fontStyle fallback if the font in use doesn't actually have that variant */
  private resolveTokenStyles(ctx: RenderContext, token: TextStyle): Partial<Styles> {
    const styles = partialTextStyleToAutoTableStyles(token);
    if (styles.fontStyle) {
      const fontName = styles.font ?? ctx.doc.getFont().fontName;
      styles.fontStyle = this.resolveSupportedFontStyle(ctx.doc, fontName, styles.fontStyle);
    }
    return styles;
  }

  /**
   * Every one of AutoTable's built-in themes sets head/foot to 'bold' by default — if the font
   * in use doesn't have that variant registered, jsPDF warns silently and falls back (the exact
   * silent failure the font decision says we must guard against ourselves); always checks
   * getFontList first before using it.
   */
  private resolveSupportedFontStyle<S extends AutoTableFontStyle>(
    doc: RenderContext['doc'],
    fontName: string,
    requested: S | undefined,
  ): S | 'normal' {
    if (!requested || requested === 'normal') return 'normal';
    const available = doc.getFontList()[fontName] ?? [];
    return available.includes(requested) ? requested : 'normal';
  }

  /**
   * columnStyles.halign only affects the body — head/foot need each column's alignment set per cell
   * full precedence: conditional > zebra > column-level (headerStyle/cellStyle) > row-type (Typography)
   * cellStyle is already merged into columnStyles before this point (see renderFlat/renderGrouped) —
   * this handles headerStyle (head section only, since columnStyles has no effect on head)
   * and zebra/conditional (body section only), which must run last so they can override cellStyle
   */
  private cellHook(
    aligns: readonly ResolvedAlign[],
    columns: readonly ReportColumn<T>[],
    rows: readonly T[],
    styleOptions: TableStyleOptions<T> | undefined,
  ): NonNullable<UserOptions['didParseCell']> {
    return (data) => {
      const align = aligns[data.column.index];

      if (data.section === 'head') {
        if (align) data.cell.styles.halign = align.header;
        const column = columns[data.column.index];
        Object.assign(data.cell.styles, partialTextStyleToAutoTableStyles(column?.headerStyle));
        return;
      }

      if (data.section === 'foot') {
        if (align) data.cell.styles.halign = align.data;
        return;
      }

      const row = rows[data.row.index];
      if (row === undefined) return;
      const override = resolveRowStyle(styleOptions, row, data.row.index);
      Object.assign(data.cell.styles, cellStyleToAutoTableStyles(override));
    };
  }

  /** alignment only — used for the grand total, which has no typed source row for resolveRowStyle to reference */
  private alignHook(aligns: readonly ResolvedAlign[]): NonNullable<UserOptions['didParseCell']> {
    return (data) => {
      const align = aligns[data.column.index];
      if (!align) return;
      if (data.section === 'head') data.cell.styles.halign = align.header;
      if (data.section === 'foot') data.cell.styles.halign = align.data;
    };
  }

  /**
   * Fail fast against silent mojibake in a cell — AutoTable draws cells itself, bypassing the
   * drawText facade (the guard inside drawText can't catch it), so we must scan them ourselves
   * before handing off to autoTable; the font is checked once outside the loop — a user who has
   * registered a font (the normal path) skips the whole scan at no cost.
   */
  private assertThaiCellsRenderable(ctx: RenderContext, options: UserOptions): void {
    const fontName = ctx.doc.getFont().fontName;
    if (!isBuiltinStandardFont(fontName)) return;

    for (const section of [options.head, options.body, options.foot]) {
      if (!section) continue;
      for (const row of section) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          const content = cellStringContent(cell);
          if (content !== undefined && containsThai(content)) {
            throw thaiGlyphError(fontName, content);
          }
        }
      }
    }
  }

  /** calls autoTable at the cursor's position, then syncs the cursor to the doc afterward */
  private runAutoTable(ctx: RenderContext, options: UserOptions): void {
    this.assertThaiCellsRenderable(ctx, options);
    const pageHeight = ctx.doc.internal.pageSize.getHeight();
    autoTable(ctx.doc, {
      startY: ctx.cursor.y,
      // margin.top/bottom must use contentTop/contentBottom (already net of the reserved
      // page header/footer) rather than the raw margins — otherwise, when AutoTable paginates
      // itself, it would draw over the band's zone
      margin: {
        top: ctx.contentTop,
        right: ctx.margins.right,
        bottom: pageHeight - ctx.contentBottom,
        left: ctx.margins.left,
      },
      // AutoTable has its own default font, 'helvetica', and doesn't inherit from doc.getFont() —
      // the doc's current font must be passed explicitly, or a registered Thai font would have no effect on the table at all
      styles: { font: ctx.doc.getFont().fontName },
      ...options,
    });

    const finalY = ctx.doc.lastAutoTable?.finalY;
    if (typeof finalY !== 'number') {
      throw new KapomError(
        'AutoTable did not set lastAutoTable.finalY after render — check the jspdf-autotable version',
      );
    }
    // AutoTable paginates on its own → the doc may now be on a different page than the cursor, so it must be synced back
    const pageIndex = ctx.doc.getCurrentPageInfo().pageNumber - 1;
    ctx.syncCursor(pageIndex, finalY);
  }

  private hasAggregate(): boolean {
    return this.node.columns.some(
      (col) => (col.type === 'data' || col.type === 'computed') && col.aggregate !== undefined,
    );
  }
}
