import { autoTable } from 'jspdf-autotable';
import type { CellDef, FontStyle as AutoTableFontStyle, RowInput, Styles, UserOptions } from 'jspdf-autotable';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { applyTextStyle, drawText } from '../core/draw-text';
import { KapomError } from '../core/errors';
import { containsThai, isBuiltinStandardFont, thaiGlyphError } from '../core/font-guard';
import { sum } from '../core/layout-math';
import { lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import { resolveRowStyle } from '../style/resolve-cell-style';
import type { ResolvedTableContent } from '../table/column-resolver';
import {
  createSegmentState,
  DEFAULT_NO_DATA_TEXT,
  DEFAULT_SUMMARY_LABEL,
  firstAggregateLabelIndex,
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
import type { ReportColumn, ResolvedAlign, RowNumberColumn, TableColumn } from '../types/column';
import { columnDepth, DEFAULT_ROW_NUMBER_MODE, flattenColumns, isAggregatableColumn, isColumnGroup, isColumnVisible, normalizeColumn, resolveColumnAlign } from '../types/column';
import type { GroupResolver, TableNode, TableStyleOptions } from '../types/node';
import { DEFAULT_NESTED_LAYOUT } from '../types/node';
import type { CellStyle, RGB, TextStyle } from '../types/primitives';

/** row height ≈ line-height + AutoTable's top/bottom cellPadding — an approximate ratio */
const ESTIMATED_ROW_HEIGHT_RATIO = 1.9;
/** group header band height as a ratio of line-height */
const GROUP_BAND_HEIGHT_RATIO = 1.6;

/** the band/grand-total background is this composite pattern's own convention — not yet open to theme override (see CLAUDE.md) */
const GROUP_BAND_FILL: RGB = [236, 240, 241];
const GRAND_TOTAL_FILL: RGB = [41, 128, 185];

/** nestedLayout 'stacked': the master identity band (row 2 of the stacked head) — tinted fill, dark bold text */
const STACKED_IDENTITY_FILL: RGB = [233, 241, 249];
const STACKED_IDENTITY_TEXT: RGB = [22, 50, 79];
/** nestedLayout 'stacked': the child header row (row 3) — a lighter tint to sit below the identity band */
const STACKED_CHILD_HEAD_FILL: RGB = [231, 237, 243];
const STACKED_CHILD_HEAD_TEXT: RGB = [51, 69, 92];

/**
 * Lay a row of `values` across `gridCols` columns — the last cell colSpans to fill any shortfall.
 * Used by nestedLayout 'stacked' to stack a K-column master row and an M-column child row in one
 * shared grid (gridCols = max(K, M)); the shorter side's last cell simply spans the extra columns.
 */
function fitRowToGrid(
  values: readonly string[],
  aligns: readonly ResolvedAlign[],
  which: keyof ResolvedAlign, // 'header' for a label row, 'data' for a values row
  gridCols: number,
  extra?: Partial<Styles>,
): CellDef[] {
  return values.map((content, idx) => {
    const isLast = idx === values.length - 1;
    const colSpan = isLast ? gridCols - (values.length - 1) : 1;
    const halign = aligns[idx]?.[which] ?? 'left';
    return { content, colSpan, styles: { halign, ...(extra ?? {}) } };
  });
}

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

/**
 * Merges an aggregate row's label cell with any immediately-following empty columns into one
 * wider colSpan cell — purely a display concern (the flat `foot` array is still what's used for
 * column-width measurement and GroupTreeNode.foot, both untouched by this). Gives the label room
 * instead of squeezing into a single narrow column (e.g. a rowNumber column, see demo 03) and
 * forces left-align, since a merged cell is now a text label, not whatever alignment the
 * underlying columns (e.g. right-aligned rowNumber) would otherwise use.
 */
function mergeFootLabel(foot: readonly string[], labelIndex: number): (string | CellDef)[] {
  if (labelIndex === -1) return [...foot];
  let span = 1;
  while (labelIndex + span < foot.length && foot[labelIndex + span] === '') span += 1;
  if (span === 1) return [...foot];

  return [
    ...foot.slice(0, labelIndex),
    { content: foot[labelIndex] ?? '', colSpan: span, styles: { halign: 'left' } },
    ...foot.slice(labelIndex + span),
  ];
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

/**
 * `rowNumber` mode 'per-page' counts per physical PDF page — a page's row 1 has to actually be
 * drawn before we know it landed on a new page, so this state is shared across every AutoTable
 * segment in a single TableBlock.render() call (a flat table's one segment, or every leaf +
 * subtotal segment in a grouped table) and mutated live from a willDrawCell hook (see
 * perPageRowNumberHook). Keyed by column index so more than one 'per-page' rowNumber column
 * (unusual, but not disallowed by the type) counts independently.
 */
interface PerPageRowNumberState {
  page: number;
  counts: Map<number, number>;
}

function createPerPageRowNumberState(): PerPageRowNumberState {
  return { page: -1, counts: new Map() };
}

export class TableBlock<T> implements MeasurableBlock {
  constructor(private readonly node: TableNode<T>) {
    if (node.nested && node.group) {
      throw new KapomError('nested (master-detail) and group cannot be combined yet — pick one');
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
    // a grouped header is multiple rows tall (the deepest column tree) — 1 for a flat header
    const headRows = Math.max(1, ...this.node.columns.map(columnDepth));

    // No-Data fallback: header + a single message row
    if (this.node.data.length === 0) return (headRows + 1) * rowHeight;

    if (this.node.nested) {
      return this.measureNested(ctx, rowHeight, footRows);
    }

    if (!this.node.group) {
      return (headRows + this.node.data.length + footRows) * rowHeight;
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

  /**
   * master-detail (nested): 1 head row + each row's own row-height, plus — for a row whose
   * `nested(row)` returns a child table — that child's own recursive measureHeight. Passing the
   * same MeasureContext straight through to the child is safe even though the child actually
   * renders narrower (indented): this estimate only measures a single 'X' character's line
   * height, which doesn't depend on the available width at all.
   */
  private measureNested(ctx: MeasureContext, rowHeight: number, footRows: number): number {
    const nested = this.node.nested;
    if (!nested) return 0;
    let height = rowHeight;
    for (const row of this.node.data) {
      height += rowHeight;
      const child = nested(row);
      if (child) height += new TableBlock(child).measureHeight(ctx);
    }
    return height + footRows * rowHeight;
  }

  render(ctx: RenderContext): void {
    if (this.node.data.length === 0) {
      this.renderNoData(ctx);
      return;
    }
    const perPage = createPerPageRowNumberState();
    if (this.node.group) {
      this.renderGrouped(ctx, this.node.group, perPage);
    } else {
      this.renderFlat(ctx, perPage);
    }
  }

  // ── No-Data fallback (empty data — review fix #5) ────────────────────────

  /** header + a single message row, colSpan across the full width — replaces the old silent empty header */
  private renderNoData(ctx: RenderContext): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const text = normalizeText(this.node.noDataText ?? DEFAULT_NO_DATA_TEXT);

    this.runAutoTable(ctx, {
      head: this.buildHeadRows(),
      body: [[{ content: text, colSpan: columns.length, styles: { halign: 'center' } }]],
      headStyles: this.resolveHeadStyles(ctx),
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

  /** columnStyles with a fixed cellWidth per column (from resolveColumnWidths), 'auto' where unset — used by the grouped + nested paths that fix one width set across every segment */
  private buildFixedColumnStyles(
    aligns: readonly ResolvedAlign[],
    columns: readonly ReportColumn<T>[],
    widths: readonly number[],
  ): Record<string, Partial<Styles>> {
    return this.buildColumnStyles(aligns, columns, (index) => ({ cellWidth: widths[index] ?? 'auto' }));
  }

  /**
   * One fixed set of column widths measured from every row across the whole table (head + all
   * body/segment rows + foot) — shared by the grouped and nested paths so their column lines stay
   * aligned across the separate AutoTable segments they emit. Measured at detailRow's fontSize
   * (the size the body actually uses).
   */
  private resolveColumnWidths(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    head: readonly string[],
    middle: readonly (readonly string[])[],
    foot: readonly string[] | undefined,
  ): number[] {
    const allRows: (readonly string[])[] = [head, ...middle, ...(foot ? [foot] : [])];
    return computeColumnWidths(
      ctx.doc,
      allRows,
      columns.map((col) => col.width),
      ctx.contentWidth,
      ctx.typography.detailRow.fontSize,
    );
  }

  /**
   * Shared preamble for both nested (master-detail) layouts: the aggregate-label slot plus one
   * fixed column-width set (and its columnStyles) measured across the whole table, so every
   * segment/stacked block emits identical column lines. `widths` is returned for the 'below' layout
   * to derive the child indent; 'stacked' uses only labelIndex + columnStyles.
   */
  private resolveNestedLayout(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    content: ResolvedTableContent,
  ): { labelIndex: number; widths: number[]; columnStyles: Record<string, Partial<Styles>> } {
    const labelIndex = firstAggregateLabelIndex(columns);
    const widths = this.resolveColumnWidths(ctx, columns, content.head, content.body, content.foot);
    const columnStyles = this.buildFixedColumnStyles(content.aligns, columns, widths);
    return { labelIndex, widths, columnStyles };
  }

  /**
   * Grand foot for a nested table whose last row carried a child — no trailing body rows for the
   * foot to attach to, so reuse the single-total-row mechanism the grand total already relies on
   * (a foot-only AutoTable call is an edge case the library doesn't guarantee).
   */
  private renderTrailingGrandFoot(
    ctx: RenderContext,
    foot: readonly string[],
    labelIndex: number,
    columnStyles: Record<string, Partial<Styles>>,
    aligns: readonly ResolvedAlign[],
  ): void {
    const rowEstimate = lineHeightOf(ctx.doc, ctx.typography.detailRow.fontSize) * ESTIMATED_ROW_HEIGHT_RATIO;
    this.renderSingleTotalRow(
      ctx,
      foot,
      labelIndex,
      columnStyles,
      aligns,
      ctx.typography.summary,
      GRAND_TOTAL_FILL,
      rowEstimate,
      this.node.style?.footer,
    );
  }

  // ── flat (ungrouped) ────────────────────────────────────────────────

  private renderFlat(ctx: RenderContext, perPage: PerPageRowNumberState): void {
    const columns = visibleColumns(this.node.columns);
    const content = resolveTableContent(this.node, ctx.numeric);

    if (this.node.nested) {
      if ((this.node.nestedLayout ?? DEFAULT_NESTED_LAYOUT) === 'stacked') {
        this.renderFlatWithNestedStacked(ctx, columns, content, perPage);
      } else {
        this.renderFlatWithNested(ctx, columns, content, perPage);
      }
      return;
    }

    const columnStyles = this.buildColumnStyles(content.aligns, columns, (index) => {
      const width = content.widths[index];
      return width !== undefined ? { cellWidth: width } : {};
    });

    this.runSegmentTable(ctx, {
      head: this.buildHeadRows(),
      body: content.body,
      foot: content.foot,
      labelIndex: firstAggregateLabelIndex(columns),
      columnStyles,
      aligns: content.aligns,
      columns,
      rows: this.node.data,
      footToken: ctx.typography.summary,
      perPage,
    });
  }

  // ── master-detail (nested): the master AutoTable is split into a segment per run of rows
  // without a child, with each nested row's own child table rendered in between ──────

  /**
   * Splits the master table around every row that has a `nested(row)` child — a row with a
   * child still shows its own values (flushed as part of the segment through that row,
   * inclusive), then the child table renders indented right after; the remaining rows continue
   * in a fresh segment. Only the trailing segment carries the grand summary foot — a mid-table
   * segment never does, since the report reads top to bottom and a summary belongs at the end.
   */
  private renderFlatWithNested(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    content: ResolvedTableContent,
    perPage: PerPageRowNumberState,
  ): void {
    const nested = this.node.nested;
    if (!nested) return;

    const indentColumn = this.node.nestedIndentColumn ?? 0;
    if (indentColumn < 0 || indentColumn >= columns.length) {
      throw new KapomError(
        `nestedIndentColumn must be between 0 and ${columns.length - 1} (got ${indentColumn})`,
      );
    }

    // a single, fixed set of column widths across every segment (same reasoning as renderGrouped)
    // — this is also what makes the nested child's indent line up exactly with the column grid,
    // like a colSpan across the remaining columns, without needing an actual colSpan cell
    const { labelIndex, widths, columnStyles } = this.resolveNestedLayout(ctx, columns, content);
    const indentX = sum(widths.slice(0, indentColumn));
    const childWidth = sum(widths.slice(indentColumn));

    const rows = this.node.data;
    let segmentStart = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row === undefined) continue;
      const child = nested(row);
      if (child === undefined) continue;

      this.runSegmentTable(ctx, {
        head: this.buildHeadRows(),
        body: content.body.slice(segmentStart, i + 1),
        foot: undefined,
        labelIndex,
        columnStyles,
        aligns: content.aligns,
        columns,
        rows: rows.slice(segmentStart, i + 1),
        footToken: ctx.typography.summary,
        perPage,
      });

      this.renderNestedChild(ctx, child, indentX, childWidth);
      segmentStart = i + 1;
    }

    if (segmentStart < rows.length) {
      this.runSegmentTable(ctx, {
        head: this.buildHeadRows(),
        body: content.body.slice(segmentStart),
        foot: content.foot,
        labelIndex,
        columnStyles,
        aligns: content.aligns,
        columns,
        rows: rows.slice(segmentStart),
        footToken: ctx.typography.summary,
        perPage,
      });
    } else if (content.foot) {
      // the last row itself had a nested child — no trailing body rows left for the foot to attach to
      this.renderTrailingGrandFoot(ctx, content.foot, labelIndex, columnStyles, content.aligns);
    }
  }

  /**
   * Renders a master-detail child table indented/narrowed to [indentX, indentX + childWidth) —
   * a plain shallow copy of RenderContext with shifted margins is enough, since TableBlock only
   * ever reads ctx.margins/ctx.contentWidth for its own horizontal placement, never ctx.cursor.x
   * directly (see drawGroupBand, which reads ctx.margins.left for the same reason).
   */
  private renderNestedChild(
    ctx: RenderContext,
    child: TableNode<unknown>,
    indentX: number,
    childWidth: number,
  ): void {
    const childCtx: RenderContext = {
      ...ctx,
      margins: {
        ...ctx.margins,
        left: ctx.margins.left + indentX,
        right: ctx.contentWidth + ctx.margins.right - indentX - childWidth,
      },
      contentWidth: childWidth,
    };
    new TableBlock(child).render(childCtx);
  }

  // ── master-detail (nested, 'stacked' layout): each master row with a child becomes one
  // self-contained table — master header + identity band + child header + child rows — so the
  // whole stacked head repeats on a page break (see TableNode.nestedLayout) ──────

  /**
   * Flat master-detail in 'stacked' layout: rows without a child flush as ordinary master
   * segments; each row *with* a child renders as its own block whose repeating head carries the
   * master identity, so a reader landing mid-detail on a later page still sees which master row
   * it belongs to. Only the trailing content carries the grand foot (a summary belongs at the end).
   */
  private renderFlatWithNestedStacked(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    content: ResolvedTableContent,
    perPage: PerPageRowNumberState,
  ): void {
    const nested = this.node.nested;
    if (!nested) return;

    const { labelIndex, columnStyles: masterColumnStyles } = this.resolveNestedLayout(ctx, columns, content);

    const rows = this.node.data;
    let segmentStart = 0;

    const flushPlain = (end: number, foot: readonly string[] | undefined): void => {
      if (segmentStart >= end) return;
      this.runSegmentTable(ctx, {
        head: this.buildHeadRows(),
        body: content.body.slice(segmentStart, end),
        foot,
        labelIndex,
        columnStyles: masterColumnStyles,
        aligns: content.aligns,
        columns,
        rows: rows.slice(segmentStart, end),
        footToken: ctx.typography.summary,
        perPage,
      });
    };

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row === undefined) continue;
      const child = nested(row);
      if (child === undefined) continue;

      flushPlain(i, undefined); // plain rows before this detail row — no mid-table foot
      const identity = content.body[i];
      if (identity) this.renderStackedBlock(ctx, columns, content.head, content.aligns, identity, child);
      segmentStart = i + 1;
    }

    if (segmentStart < rows.length) {
      flushPlain(rows.length, content.foot); // trailing plain rows carry the grand foot
    } else if (content.foot) {
      // the last row had a child — no trailing plain rows for the foot to attach to
      this.renderTrailingGrandFoot(ctx, content.foot, labelIndex, masterColumnStyles, content.aligns);
    }
  }

  /**
   * One detail block as a single AutoTable: [master header · identity band · child header] as a
   * 3-row repeating head, then the child rows as the body. The master (K columns) and child
   * (M columns) share one grid of max(K, M) columns — each row's last cell colSpans to fill (see
   * fitRowToGrid). Because the identity is a head row, it reprints on every page the child spans.
   */
  private renderStackedBlock(
    ctx: RenderContext,
    masterColumns: readonly ReportColumn<T>[],
    masterHead: readonly string[],
    masterAligns: readonly ResolvedAlign[],
    identity: readonly string[],
    child: TableNode<unknown>,
  ): void {
    const childColumns = visibleColumns(child.columns);
    const childContent = resolveTableContent(child, ctx.numeric);
    const gridCols = Math.max(masterColumns.length, childColumns.length);
    const fontName = ctx.doc.getFont().fontName;
    const bold = this.resolveSupportedFontStyle(ctx.doc, fontName, 'bold');

    const identityStyle: Partial<Styles> = {
      fillColor: [...STACKED_IDENTITY_FILL],
      textColor: [...STACKED_IDENTITY_TEXT],
      fontStyle: bold,
    };
    const childHeadStyle: Partial<Styles> = {
      fillColor: [...STACKED_CHILD_HEAD_FILL],
      textColor: [...STACKED_CHILD_HEAD_TEXT],
      fontStyle: bold,
    };

    const head: RowInput[] = [
      fitRowToGrid(masterHead, masterAligns, 'header', gridCols), // row 1: master column labels (uses headStyles)
      fitRowToGrid(identity, masterAligns, 'data', gridCols, identityStyle), // row 2: this master row's values
      fitRowToGrid(childContent.head, childContent.aligns, 'header', gridCols, childHeadStyle), // row 3: child labels
    ];
    const body: RowInput[] = childContent.body.map((r) => fitRowToGrid(r, childContent.aligns, 'data', gridCols));

    this.runAutoTable(ctx, {
      head,
      body,
      headStyles: this.resolveHeadStyles(ctx),
      bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
    });
  }

  // ── grouped (composite: a band + segment per group + grand total; recursive when there's a subGroup) ──────

  private renderGrouped(ctx: RenderContext, resolver: GroupResolver<T>, perPage: PerPageRowNumberState): void {
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
    const widths = this.resolveColumnWidths(ctx, columns, head, flattenGroupTreeRows(tree), grandFoot);
    const columnStyles = this.buildFixedColumnStyles(aligns, columns, widths);

    const lineHeight = lineHeightOf(ctx.doc, ctx.typography.detailRow.fontSize);
    const bandHeight = lineHeight * GROUP_BAND_HEIGHT_RATIO;
    const rowEstimate = lineHeight * ESTIMATED_ROW_HEIGHT_RATIO;
    const labelIndex = firstAggregateLabelIndex(columns);

    this.renderGroupTree(ctx, tree, {
      head: this.buildHeadRows(),
      aligns,
      columns,
      columnStyles,
      bandHeight,
      rowEstimate,
      labelIndex,
      perPage,
    });

    if (grandFoot) {
      // the grand total is a single, boldly-styled body row — not AutoTable's own foot, because
      // a table with only a foot and no body is an edge case the library doesn't guarantee (same
      // reasoning as a non-leaf group's subtotal — see renderSingleTotalRow)
      this.renderSingleTotalRow(
        ctx,
        grandFoot,
        labelIndex,
        columnStyles,
        aligns,
        ctx.typography.summary,
        GRAND_TOTAL_FILL,
        rowEstimate,
        this.node.style?.footer,
      );
    }
  }

  /** the shared context passed down every level of renderGroupTree (computed once in renderGrouped) */
  private renderGroupTree(
    ctx: RenderContext,
    tree: readonly GroupTreeNode<T>[],
    shared: {
      head: RowInput[];
      aligns: readonly ResolvedAlign[];
      columns: readonly ReportColumn<T>[];
      columnStyles: Record<string, Partial<Styles>>;
      bandHeight: number;
      rowEstimate: number;
      labelIndex: number;
      perPage: PerPageRowNumberState;
    },
  ): void {
    for (const node of tree) {
      // keep-together: the band (+ any child bands nested below it) + head + the first N rows must all land on the same page
      ctx.ensureSpace(this.requiredSpaceFor(node, shared.bandHeight, shared.rowEstimate));
      this.drawGroupBand(ctx, node.label, shared.bandHeight, node.depth);

      if (node.children) {
        this.renderGroupTree(ctx, node.children, shared);
        // a non-leaf subtotal has no segment to attach a foot to — drawn as a separate single row instead
        if (node.foot) {
          this.renderSingleTotalRow(
            ctx,
            node.foot,
            shared.labelIndex,
            shared.columnStyles,
            shared.aligns,
            ctx.typography.groupFooter,
            GROUP_BAND_FILL,
            shared.rowEstimate,
          );
        }
        continue;
      }

      this.runSegmentTable(ctx, {
        head: shared.head,
        body: node.body ?? [],
        foot: node.foot,
        labelIndex: shared.labelIndex,
        columnStyles: shared.columnStyles,
        aligns: shared.aligns,
        columns: shared.columns,
        rows: node.rows,
        footToken: ctx.typography.groupFooter,
        perPage: shared.perPage,
      });
    }
  }

  /**
   * Runs one AutoTable segment (a flat table's only segment, or one leaf's segment in a grouped
   * table) — head/body/optional-foot/columnStyles/didParseCell wiring shared by both callers;
   * only the foot's Typography token differs between them (summary vs groupFooter).
   */
  private runSegmentTable(
    ctx: RenderContext,
    params: {
      head: RowInput[];
      body: string[][];
      foot: readonly string[] | undefined;
      labelIndex: number;
      columnStyles: Record<string, Partial<Styles>>;
      aligns: readonly ResolvedAlign[];
      columns: readonly ReportColumn<T>[];
      rows: readonly T[];
      footToken: TextStyle;
      perPage: PerPageRowNumberState;
    },
  ): void {
    const { head, body, foot, labelIndex, columnStyles, aligns, columns, rows, footToken, perPage } = params;
    const willDrawCell = this.perPageRowNumberHook(ctx, columns, perPage);
    this.runAutoTable(ctx, {
      head,
      body,
      ...(foot ? { foot: [mergeFootLabel(foot, labelIndex)] } : {}),
      columnStyles,
      headStyles: this.resolveHeadStyles(ctx),
      bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
      footStyles: this.resolveFootStyles(ctx, footToken),
      didParseCell: this.cellHook(aligns, columns, rows, this.node.style),
      ...(willDrawCell ? { willDrawCell } : {}),
    });
  }

  /**
   * `rowNumber` mode 'per-page' can only be resolved once AutoTable has actually decided which
   * page a row lands on — willDrawCell fires per body cell right after that decision (addPage()
   * has already run for this row if needed) and right before it's drawn, so `data.pageNumber` is
   * the real, final page number. Returns undefined (no hook attached) when this segment has no
   * 'per-page' rowNumber column, so the common case pays nothing extra.
   */
  private perPageRowNumberHook(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    state: PerPageRowNumberState,
  ): NonNullable<UserOptions['willDrawCell']> | undefined {
    const perPageColumns = new Map<number, RowNumberColumn>();
    columns.forEach((col, index) => {
      if (col.type === 'rowNumber' && (col.mode ?? DEFAULT_ROW_NUMBER_MODE) === 'per-page') {
        perPageColumns.set(index, col);
      }
    });
    if (perPageColumns.size === 0) return undefined;

    return (data) => {
      if (data.section !== 'body') return;
      const col = perPageColumns.get(data.column.index);
      if (!col) return;

      if (state.page !== data.pageNumber) {
        state.page = data.pageNumber;
        state.counts.clear();
      }
      const count = (state.counts.get(data.column.index) ?? 0) + 1;
      state.counts.set(data.column.index, count);

      const n = (col.startAt ?? 1) + count - 1;
      const text = normalizeText(col.formatter ? col.formatter(n) : String(n));

      // AutoTable draws this cell's text itself, bypassing the drawText facade guard entirely —
      // re-check here the same way assertThaiCellsRenderable does, since a user's formatter could return anything
      const fontName = ctx.doc.getFont().fontName;
      if (isBuiltinStandardFont(fontName) && containsThai(text)) {
        throw thaiGlyphError(fontName, text);
      }
      data.cell.text = [text];
    };
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
   * A single, boldly-styled body row for a total that has no AutoTable segment of its own — used
   * by both the grand total and a non-leaf group's subtotal (nested group). theme 'plain' for the
   * same reason in both cases: a foot-only table is an edge case AutoTable doesn't guarantee, and
   * the default theme ('striped') always sets alternateRow.fillColor for even body row indexes
   * (this row is the only one = index 0 = always even), which would silently override fillColor
   * (observed for real on a demo — the background faded to gray instead of the intended color);
   * 'plain' doesn't define alternateRow at all, sidestepping the problem entirely.
   */
  private renderSingleTotalRow(
    ctx: RenderContext,
    foot: readonly string[],
    labelIndex: number,
    columnStyles: Record<string, Partial<Styles>>,
    aligns: readonly ResolvedAlign[],
    token: TextStyle,
    fillColor: RGB,
    rowEstimate: number,
    // grand-total callers pass `style.footer` here so the row can be themed like the leaf foot;
    // the group-band subtotal caller passes nothing, keeping its fixed band identity
    override?: Partial<CellStyle>,
  ): void {
    ctx.ensureSpace(rowEstimate);
    const base: Partial<Styles> = { ...this.resolveTokenStyles(ctx, token), fillColor: [...fillColor] };
    this.runAutoTable(ctx, {
      theme: 'plain',
      body: [mergeFootLabel(foot, labelIndex)],
      columnStyles,
      bodyStyles: this.applyStyleOverride(ctx, base, override),
      didParseCell: this.alignHook(aligns),
    });
  }

  private drawGroupBand(ctx: RenderContext, label: string, bandHeight: number, depth = 0): void {
    const { doc, cursor, contentWidth, margins } = ctx;
    const token = ctx.typography.groupHeader;
    const [r, g, b] = GROUP_BAND_FILL;
    doc.setFillColor(r, g, b);
    // margins.left, not cursor.x — cursor.x always equals margins.left in every existing case
    // (both only ever reset together), but only margins.left correctly follows a nested-table
    // child's indent (see renderNestedChild), since that overrides ctx.margins, not the cursor
    doc.rect(margins.left, cursor.y, contentWidth, bandHeight, 'F');

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
    drawText(doc, label, margins.left + inset + indent, cursor.y + lineHeight * 1.15);

    ctx.advanceY(bandHeight);
  }

  // ── style resolution ──────────────────────────────────────────────────

  /** Typography token → AutoTable styles with a fontStyle fallback if the font in use doesn't actually have that variant */
  private resolveTokenStyles(ctx: RenderContext, token: TextStyle): Partial<Styles> {
    const styles = partialTextStyleToAutoTableStyles(token);
    this.guardFontStyle(ctx, styles);
    return styles;
  }

  /** replace styles.fontStyle with 'normal' if the font in use lacks that variant (mutates in place) — shared by token/head style resolution */
  private guardFontStyle(ctx: RenderContext, styles: Partial<Styles>): void {
    if (!styles.fontStyle) return;
    const fontName = styles.font ?? ctx.doc.getFont().fontName;
    styles.fontStyle = this.resolveSupportedFontStyle(ctx.doc, fontName, styles.fontStyle);
  }

  /**
   * The head as AutoTable rows — a single row of leaf headers normally, or a multi-row header when
   * any top-level column is a group (nested to any depth). Built recursively: a group's `header`
   * gets `colSpan` = its visible-leaf count and sits on its own depth's row; a leaf's header gets
   * `rowSpan` = the rows remaining below it (so it stretches to the bottom, vertically centered).
   * Grouped-head cells carry their own inline styles, so cellHook skips styling any object head cell.
   */
  private buildHeadRows(): RowInput[] {
    const topColumns = this.node.columns.filter((col) => isColumnGroup(col) || isColumnVisible(col));

    if (!topColumns.some(isColumnGroup)) {
      // single row of plain strings — cellHook applies alignment (backward-compatible path unchanged)
      return [flattenColumns(topColumns).filter(isColumnVisible).map((col) => normalizeText(col.header))];
    }

    const totalRows = Math.max(...topColumns.map(columnDepth));
    const rows: CellDef[][] = Array.from({ length: totalRows }, () => []);
    const rowAt = (index: number): CellDef[] => {
      const row = rows[index];
      if (!row) throw new KapomError(`buildHeadRows: header row ${index} is out of range`);
      return row;
    };

    const place = (col: TableColumn<T>, depth: number): void => {
      if (isColumnGroup(col)) {
        const leaves = flattenColumns(col.columns).filter(isColumnVisible);
        if (leaves.length === 0) return;
        rowAt(depth).push({
          content: normalizeText(col.header),
          colSpan: leaves.length,
          styles: { halign: col.headerAlign ?? 'center', valign: 'middle' },
        });
        for (const child of col.columns) place(child, depth + 1);
      } else if (isColumnVisible(col)) {
        const leaf = normalizeColumn(col); // shorthand → data, so headCellStyles/resolveColumnAlign work
        // a leaf stretches from its own row down to the bottom (rowSpan) → vertically centered
        rowAt(depth).push({
          content: normalizeText(leaf.header),
          rowSpan: totalRows - depth,
          styles: { ...this.headCellStyles(leaf), valign: 'middle' },
        });
      }
    };

    for (const col of topColumns) place(col, 0);
    return rows;
  }

  /** inline styles for a leaf head cell (halign + per-column headerStyle) — used in the 2-row grouped head, where cellHook skips object cells */
  private headCellStyles(col: ReportColumn<T>): Partial<Styles> {
    return {
      halign: resolveColumnAlign(col).header,
      ...partialTextStyleToAutoTableStyles(col.headerStyle),
    };
  }

  /** merge an optional CellStyle override over a base style through the fontStyle-variant guard — shared by the symmetric head/foot resolvers */
  private applyStyleOverride(
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
  private resolveHeadStyles(ctx: RenderContext): Partial<Styles> {
    // header cells default to vertically centered (matters for a rowSpan cell in a grouped head;
    // harmless for a single-row header) — applies to the whole head section, overridable per cell
    const base: Partial<Styles> = { valign: 'middle', ...this.resolveTokenStyles(ctx, ctx.typography.columnHeader) };
    return this.applyStyleOverride(ctx, base, this.node.style?.header);
  }

  /** foot styles = the Typography foot token merged with an optional per-table `style.footer` override (symmetric with resolveHeadStyles) */
  private resolveFootStyles(ctx: RenderContext, footToken: TextStyle): Partial<Styles> {
    const base = this.resolveTokenStyles(ctx, footToken);
    return this.applyStyleOverride(ctx, base, this.node.style?.footer);
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
        // a CellDef head cell (group super-header / rowSpan leaf in a 2-row head) carries its own
        // inline styles — leave it alone (mirrors the foot branch's merged-label guard)
        if (typeof data.cell.raw === 'object') return;
        if (align) data.cell.styles.halign = align.header;
        const column = columns[data.column.index];
        Object.assign(data.cell.styles, partialTextStyleToAutoTableStyles(column?.headerStyle));
        return;
      }

      if (data.section === 'foot') {
        // a merged label cell (mergeFootLabel) carries its own explicit halign — never override it here
        if (align && typeof data.cell.raw !== 'object') data.cell.styles.halign = align.data;
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
      // a CellDef head cell (group super-header) keeps its own inline halign
      if (data.section === 'head' && typeof data.cell.raw !== 'object') data.cell.styles.halign = align.header;
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
    return flattenColumns(this.node.columns).some(
      (col) => isAggregatableColumn(col) && col.aggregate !== undefined,
    );
  }
}
