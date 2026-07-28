import { autoTable } from 'jspdf-autotable';
import type { RowInput, Styles, UserOptions } from 'jspdf-autotable';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { applyTextStyle, drawText } from '../core/draw-text';
import { KapomError } from '../core/errors';
import { containsThai, isBuiltinStandardFont, thaiGlyphError } from '../core/font-guard';
import { sum } from '../core/layout-math';
import { lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import { resolveRowStyle } from '../style/resolve-cell-style';
import {
  cellStringContent,
  cellStyleToAutoTableStyles,
  fitRowToGrid,
  mergeFootLabel,
} from '../table/autotable-styles';
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
import { buildHeadRows } from '../table/head-rows';
import type { ReportColumn, ResolvedAlign, RowNumberColumn } from '../types/column';
import { columnDepth, DEFAULT_ROW_NUMBER_MODE, flattenColumns, isAggregatableColumn, resolveColumnAlign } from '../types/column';
import type { GroupResolver, TableNode, TableStyleOptions } from '../types/node';
import { DEFAULT_NESTED_LAYOUT } from '../types/node';
import type { CellStyle, RGB, TextStyle } from '../types/primitives';
import { TableStyleResolver } from './table-style-resolver';

/** row height ≈ line-height + AutoTable's top/bottom cellPadding — an approximate ratio */
const ESTIMATED_ROW_HEIGHT_RATIO = 1.9;
/** group header band height as a ratio of line-height */
const GROUP_BAND_HEIGHT_RATIO = 1.6;

/**
 * How deep master-detail tables may nest before it's treated as a mistake. `nested(row)` builds the
 * child table on demand, so a resolver defined in terms of itself (`const node = (rows) => ({ …,
 * nested: (r) => node(r.children) })`) over data that never bottoms out recurses forever — which
 * surfaced as a bare "Maximum call stack size exceeded" from somewhere deep in measure. The limit is
 * far past anything that fits on a page: even three levels of indented sub-tables is a hard read.
 */
const MAX_NESTED_DEPTH = 10;

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

/** row/band height estimates derived once from the body font's line height — shared by measureHeight and every render path */
interface RowMetrics {
  rowEstimate: number;
  bandHeight: number;
}

function rowMetricsFromLineHeight(lineHeight: number): RowMetrics {
  return {
    rowEstimate: lineHeight * ESTIMATED_ROW_HEIGHT_RATIO,
    bandHeight: lineHeight * GROUP_BAND_HEIGHT_RATIO,
  };
}

/** the fields fixed across every AutoTable segment of one table render — head/columns/styles/aligns/label slot/per-page state */
interface SegmentContext<T> {
  head: RowInput[];
  aligns: readonly ResolvedAlign[];
  columns: readonly ReportColumn<T>[];
  columnStyles: Record<string, Partial<Styles>>;
  labelIndex: number;
  perPage: PerPageRowNumberState;
}

/** the styling of a single-total row (grand total or a non-leaf subtotal) — see renderSingleTotalRow */
interface TotalRowStyle {
  token: TextStyle;
  fillColor: RGB;
  textColor: RGB;
  /** grand totals theme the row like the leaf foot (style.footer); a group-band subtotal passes nothing */
  override?: Partial<CellStyle>;
}

/** a table shape's paired height-estimate + render — selected once by TableBlock.layout() */
interface TableLayout {
  measure(ctx: MeasureContext): number;
  render(ctx: RenderContext): void;
}

export class TableBlock<T> implements MeasurableBlock {
  /** the render-time style layer (Typography tokens + per-table overrides + theme → AutoTable styles) */
  private readonly styles: TableStyleResolver<T>;

  /**
   * `nested(row)` resolved once per row, shared by measureHeight and render. It's the user's own
   * callback and is usually a scan over a bigger array, but measure and render each walk every row,
   * so it used to run twice per row — and twice again per row of every child, compounding down the
   * tree, since each level built a throwaway child TableBlock for measuring and another for
   * rendering. The child blocks are cached alongside for the same reason. Lazy: a table with no
   * `nested` never allocates, and a block that is only measured pays for one pass.
   */
  private nestedChildren: readonly (TableBlock<unknown> | undefined)[] | undefined;

  /** how many master-detail levels sit above this block — see MAX_NESTED_DEPTH */
  private readonly depth: number;

  constructor(private readonly node: TableNode<T>, depth = 0) {
    if (node.nested && node.group) {
      throw new KapomError('nested (master-detail) and group cannot be combined yet — pick one');
    }
    if (depth > MAX_NESTED_DEPTH) {
      throw new KapomError(
        `nested (master-detail) tables are more than ${MAX_NESTED_DEPTH} levels deep — this is ` +
          `almost always a nested() resolver that never bottoms out (it returns a child for every ` +
          `row, including the deepest). Return undefined for a row with no detail.`,
      );
    }
    this.depth = depth;
    this.styles = new TableStyleResolver(node.style);
  }

  /**
   * The nested child of each row, as a ready block — built on first use and reused by both passes.
   * Empty when the table has no `nested` resolver at all.
   */
  private resolveNestedChildren(): readonly (TableBlock<unknown> | undefined)[] {
    if (this.nestedChildren) return this.nestedChildren;
    const nested = this.node.nested;
    const resolved = nested
      ? this.node.data.map((row) => {
          const child = nested(row);
          return child ? new TableBlock(child, this.depth + 1) : undefined;
        })
      : [];
    this.nestedChildren = resolved;
    return resolved;
  }

  /**
   * An estimate, not an exact figure — used only to decide whether to break before starting the
   * table (wrapping within cells / the real style is only known once AutoTable draws); a table
   * longer than a page already paginates itself within AutoTable, so the engine doesn't need to
   * know the real height.
   */
  measureHeight(ctx: MeasureContext): number {
    return this.layout().measure(ctx);
  }

  render(ctx: RenderContext): void {
    this.layout().render(ctx);
  }

  /**
   * Picks the measure+render pair for this table's shape — one dispatch point instead of the same
   * four-way branch duplicated across measureHeight and render. The shapes are mutually exclusive
   * (the constructor already forbids nested+group), checked in a fixed priority: empty data first,
   * then nested (master-detail), then grouped, else the plain flat table.
   */
  private layout(): TableLayout {
    if (this.node.data.length === 0) {
      return { measure: (ctx) => this.measureNoData(ctx), render: (ctx) => this.renderNoData(ctx) };
    }
    if (this.node.nested) {
      return { measure: (ctx) => this.measureNested(ctx), render: (ctx) => this.renderNested(ctx) };
    }
    const group = this.node.group;
    if (group) {
      return { measure: (ctx) => this.measureGrouped(ctx, group), render: (ctx) => this.renderGrouped(ctx, group) };
    }
    return { measure: (ctx) => this.measureFlat(ctx), render: (ctx) => this.renderFlat(ctx) };
  }

  /** the shared height inputs for the measure strategies — all from a single 'X' line-height (measureHeight has no doc, so measureText not lineHeightOf) */
  private measureBasis(ctx: MeasureContext): { rowHeight: number; bandHeight: number; footRows: number; headRows: number } {
    const { rowEstimate: rowHeight, bandHeight } = rowMetricsFromLineHeight(
      ctx.measureText('X', ctx.typography.detailRow.fontSize, ctx.contentWidth),
    );
    return {
      rowHeight,
      bandHeight,
      footRows: this.hasAggregate() ? 1 : 0,
      // a grouped header is multiple rows tall (the deepest column tree) — 1 for a flat header
      headRows: Math.max(1, ...this.node.columns.map(columnDepth)),
    };
  }

  /** No-Data fallback: header + a single message row */
  private measureNoData(ctx: MeasureContext): number {
    const { rowHeight, headRows } = this.measureBasis(ctx);
    return (headRows + 1) * rowHeight;
  }

  /** flat: head + every body row + optional foot */
  private measureFlat(ctx: MeasureContext): number {
    const { rowHeight, footRows, headRows } = this.measureBasis(ctx);
    return (headRows + this.node.data.length + footRows) * rowHeight;
  }

  /**
   * grouped: every group at every level has a band + subtotal (if there's an aggregate); a leaf
   * segment has its own head. countGroupBands counts across every level of the subGroup chain.
   */
  private measureGrouped(ctx: MeasureContext, group: GroupResolver<T>): number {
    const { rowHeight, bandHeight, footRows } = this.measureBasis(ctx);
    const groupCount = countGroupBands(group, this.node.data);
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
  private measureNested(ctx: MeasureContext): number {
    if (!this.node.nested) return 0;
    const { rowHeight, footRows } = this.measureBasis(ctx);
    const children = this.resolveNestedChildren();
    let height = rowHeight;
    for (const child of children) {
      height += rowHeight;
      if (child) height += child.measureHeight(ctx);
    }
    return height + footRows * rowHeight;
  }

  // ── No-Data fallback (empty data — review fix #5) ────────────────────────

  /** header + a single message row, colSpan across the full width — replaces the old silent empty header */
  private renderNoData(ctx: RenderContext): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const text = normalizeText(this.node.noDataText ?? DEFAULT_NO_DATA_TEXT);

    this.runAutoTable(ctx, {
      head: buildHeadRows(this.node.columns),
      body: [[{ content: text, colSpan: columns.length, styles: { halign: 'center' } }]],
      headStyles: this.styles.resolveHeadStyles(ctx),
      bodyStyles: this.styles.resolveTokenStyles(ctx, ctx.typography.detailRow),
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
        ...cellStyleToAutoTableStyles(columns[index]?.cellStyle),
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

  /** row/band height estimates for the render paths — the body font's real line height (lineHeightOf needs the doc) */
  private estimateRowMetrics(ctx: RenderContext): RowMetrics {
    return rowMetricsFromLineHeight(lineHeightOf(ctx.doc, ctx.typography.detailRow.fontSize));
  }

  /** the grand total's styling — themed like the leaf foot (theme.primary + optional style.footer); shared by the grouped and nested-trailing grand foots */
  private grandTotalStyle(ctx: RenderContext): TotalRowStyle {
    const footer = this.node.style?.footer;
    return {
      token: ctx.typography.summary,
      fillColor: ctx.theme.primary,
      textColor: ctx.theme.onPrimary,
      ...(footer !== undefined ? { override: footer } : {}),
    };
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
    const { rowEstimate } = this.estimateRowMetrics(ctx);
    this.renderSingleTotalRow(ctx, foot, labelIndex, columnStyles, aligns, rowEstimate, this.grandTotalStyle(ctx));
  }

  // ── flat (ungrouped) ────────────────────────────────────────────────

  private renderFlat(ctx: RenderContext): void {
    const perPage = createPerPageRowNumberState();
    const columns = visibleColumns(this.node.columns);
    const content = resolveTableContent(this.node, ctx.numeric);

    const columnStyles = this.buildColumnStyles(content.aligns, columns, (index) => {
      const width = content.widths[index];
      return width !== undefined ? { cellWidth: width } : {};
    });

    this.runSegmentTable(ctx, {
      head: buildHeadRows(this.node.columns),
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

  // ── master-detail (nested): dispatches to the 'below' or 'stacked' layout ──────

  private renderNested(ctx: RenderContext): void {
    const perPage = createPerPageRowNumberState();
    const columns = visibleColumns(this.node.columns);
    const content = resolveTableContent(this.node, ctx.numeric);
    if ((this.node.nestedLayout ?? DEFAULT_NESTED_LAYOUT) === 'stacked') {
      this.renderFlatWithNestedStacked(ctx, columns, content, perPage);
    } else {
      this.renderFlatWithNested(ctx, columns, content, perPage);
    }
  }

  // ── master-detail (nested): the master AutoTable is split into a segment per run of rows
  // without a child, with each nested row's own child table rendered in between ──────

  /**
   * Shared skeleton for both nested (master-detail) layouts: walk the master rows, and at every row
   * that has a `nested(row)` child, flush the master rows up to that point as one AutoTable segment
   * (never a mid-table foot), then draw the detail via `renderDetail`. Only the trailing content
   * carries the grand foot — the report reads top to bottom and a summary belongs at the end. The
   * two layouts differ in exactly two points: whether the detail row's own values join the preceding
   * master segment (`masterInclusive` — 'below' shows them, 'stacked' promotes them to the detail's
   * identity head) and how the detail itself is drawn (`renderDetail`).
   */
  private renderNestedSegments(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    content: ResolvedTableContent,
    perPage: PerPageRowNumberState,
    options: {
      labelIndex: number;
      columnStyles: Record<string, Partial<Styles>>;
      masterInclusive: boolean;
      renderDetail: (rowIndex: number, child: TableBlock<unknown>) => void;
    },
  ): void {
    if (!this.node.nested) return;
    const { labelIndex, columnStyles, masterInclusive, renderDetail } = options;
    const rows = this.node.data;
    const children = this.resolveNestedChildren();
    let segmentStart = 0;

    const flush = (end: number, foot: readonly string[] | undefined): void => {
      if (segmentStart >= end) return;
      this.runSegmentTable(ctx, {
        head: buildHeadRows(this.node.columns),
        body: content.body.slice(segmentStart, end),
        foot,
        labelIndex,
        columnStyles,
        aligns: content.aligns,
        columns,
        rows: rows.slice(segmentStart, end),
        footToken: ctx.typography.summary,
        perPage,
      });
    };

    for (let i = 0; i < rows.length; i += 1) {
      const child = children[i];
      if (child === undefined) continue;

      flush(masterInclusive ? i + 1 : i, undefined); // detail row joins the master segment ('below') or is excluded ('stacked')
      renderDetail(i, child);
      segmentStart = i + 1;
    }

    if (segmentStart < rows.length) {
      flush(rows.length, content.foot); // trailing rows carry the grand foot
    } else if (content.foot) {
      // the last row itself had a child — no trailing rows left for the foot to attach to
      this.renderTrailingGrandFoot(ctx, content.foot, labelIndex, columnStyles, content.aligns);
    }
  }

  /**
   * 'below' layout: a row with a child still shows its own values (part of the segment through that
   * row, inclusive), then the child table renders indented right after — a fixed column-width set
   * across every segment makes the child's indent line up with the column grid, like a colSpan
   * across the remaining columns without an actual colSpan cell.
   */
  private renderFlatWithNested(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    content: ResolvedTableContent,
    perPage: PerPageRowNumberState,
  ): void {
    const indentColumn = this.node.nestedIndentColumn ?? 0;
    if (indentColumn < 0 || indentColumn >= columns.length) {
      throw new KapomError(
        `nestedIndentColumn must be between 0 and ${columns.length - 1} (got ${indentColumn})`,
      );
    }

    const { labelIndex, widths, columnStyles } = this.resolveNestedLayout(ctx, columns, content);
    const indentX = sum(widths.slice(0, indentColumn));
    const childWidth = sum(widths.slice(indentColumn));

    this.renderNestedSegments(ctx, columns, content, perPage, {
      labelIndex,
      columnStyles,
      masterInclusive: true,
      renderDetail: (_i, child) => this.renderNestedChild(ctx, child, indentX, childWidth),
    });
  }

  /**
   * Renders a master-detail child table indented/narrowed to [indentX, indentX + childWidth) —
   * a plain shallow copy of RenderContext with shifted margins is enough, since TableBlock only
   * ever reads ctx.margins/ctx.contentWidth for its own horizontal placement, never ctx.cursor.x
   * directly (see drawGroupBand, which reads ctx.margins.left for the same reason).
   */
  private renderNestedChild(
    ctx: RenderContext,
    child: TableBlock<unknown>,
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
    child.render(childCtx);
  }

  // ── master-detail (nested, 'stacked' layout): each master row with a child becomes one
  // self-contained table — master header + identity band + child header + child rows — so the
  // whole stacked head repeats on a page break (see TableNode.nestedLayout) ──────

  /**
   * 'stacked' layout: rows without a child flush as ordinary master segments; each row *with* a
   * child renders as its own block whose repeating head carries the master identity, so a reader
   * landing mid-detail on a later page still sees which master row it belongs to. The detail row is
   * excluded from the preceding segment (masterInclusive: false) — its values become the identity head.
   */
  private renderFlatWithNestedStacked(
    ctx: RenderContext,
    columns: readonly ReportColumn<T>[],
    content: ResolvedTableContent,
    perPage: PerPageRowNumberState,
  ): void {
    const { labelIndex, columnStyles } = this.resolveNestedLayout(ctx, columns, content);

    this.renderNestedSegments(ctx, columns, content, perPage, {
      labelIndex,
      columnStyles,
      masterInclusive: false,
      renderDetail: (i, child) => {
        const identity = content.body[i];
        if (identity) this.renderStackedBlock(ctx, columns, content.head, content.aligns, identity, child);
      },
    });
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
    childBlock: TableBlock<unknown>,
  ): void {
    // this layout flattens the child into the same AutoTable rather than delegating to its
    // render(), so it reads the child's node directly — reachable here because `node` is private
    // to TableBlock, and this *is* TableBlock (a different type argument is still the same class)
    const child = childBlock.node;
    const childColumns = visibleColumns(child.columns);
    const childContent = resolveTableContent(child, ctx.numeric);
    const gridCols = Math.max(masterColumns.length, childColumns.length);
    const fontName = ctx.doc.getFont().fontName;
    const bold = this.styles.resolveSupportedFontStyle(ctx.doc, fontName, 'bold');

    const identityStyle: Partial<Styles> = {
      fillColor: [...ctx.theme.nestedIdentityFill],
      textColor: [...ctx.theme.nestedIdentityText],
      fontStyle: bold,
    };
    const childHeadStyle: Partial<Styles> = {
      fillColor: [...ctx.theme.nestedChildFill],
      textColor: [...ctx.theme.nestedChildText],
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
      headStyles: this.styles.resolveHeadStyles(ctx),
      bodyStyles: this.styles.resolveTokenStyles(ctx, ctx.typography.detailRow),
    });
  }

  // ── grouped (composite: a band + segment per group + grand total; recursive when there's a subGroup) ──────

  private renderGrouped(ctx: RenderContext, resolver: GroupResolver<T>): void {
    const perPage = createPerPageRowNumberState();
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

    const { bandHeight, rowEstimate } = this.estimateRowMetrics(ctx);
    const labelIndex = firstAggregateLabelIndex(columns);

    this.renderGroupTree(ctx, tree, {
      head: buildHeadRows(this.node.columns),
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
      this.renderSingleTotalRow(ctx, grandFoot, labelIndex, columnStyles, aligns, rowEstimate, this.grandTotalStyle(ctx));
    }
  }

  /** the shared context passed down every level of renderGroupTree (computed once in renderGrouped) — plus the two height estimates the keep-together check needs */
  private renderGroupTree(
    ctx: RenderContext,
    tree: readonly GroupTreeNode<T>[],
    shared: SegmentContext<T> & { bandHeight: number; rowEstimate: number },
  ): void {
    for (const node of tree) {
      // keep-together: the band (+ any child bands nested below it) + head + the first N rows must all land on the same page
      ctx.ensureSpace(this.requiredSpaceFor(node, shared.bandHeight, shared.rowEstimate));
      this.drawGroupBand(ctx, node.label, shared.bandHeight, node.depth);

      if (node.children) {
        this.renderGroupTree(ctx, node.children, shared);
        // a non-leaf subtotal has no segment to attach a foot to — drawn as a separate single row instead
        if (node.foot) {
          this.renderSingleTotalRow(ctx, node.foot, shared.labelIndex, shared.columnStyles, shared.aligns, shared.rowEstimate, {
            token: ctx.typography.groupFooter,
            fillColor: ctx.theme.bandFill,
            textColor: ctx.theme.onBand,
          });
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
    params: SegmentContext<T> & {
      body: string[][];
      foot: readonly string[] | undefined;
      rows: readonly T[];
      footToken: TextStyle;
    },
  ): void {
    const { head, body, foot, labelIndex, columnStyles, aligns, columns, rows, footToken, perPage } = params;
    const willDrawCell = this.perPageRowNumberHook(ctx, columns, perPage);
    this.runAutoTable(ctx, {
      head,
      body,
      ...(foot ? { foot: [mergeFootLabel(foot, labelIndex)] } : {}),
      columnStyles,
      headStyles: this.styles.resolveHeadStyles(ctx),
      bodyStyles: this.styles.resolveTokenStyles(ctx, ctx.typography.detailRow),
      footStyles: this.styles.resolveFootStyles(ctx, footToken),
      didParseCell: this.cellHook(aligns, columns, rows, this.styles.effectiveStyle(ctx)),
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
    rowEstimate: number,
    style: TotalRowStyle,
  ): void {
    ctx.ensureSpace(rowEstimate);
    const base: Partial<Styles> = {
      ...this.styles.resolveTokenStyles(ctx, style.token),
      fillColor: [...style.fillColor],
      textColor: [...style.textColor],
    };
    this.runAutoTable(ctx, {
      theme: 'plain',
      body: [mergeFootLabel(foot, labelIndex)],
      columnStyles,
      bodyStyles: this.styles.applyStyleOverride(ctx, base, style.override),
      didParseCell: this.alignHook(aligns),
    });
  }

  private drawGroupBand(ctx: RenderContext, label: string, bandHeight: number, depth = 0): void {
    const { doc, cursor, contentWidth, margins } = ctx;
    const token = ctx.typography.groupHeader;
    const [r, g, b] = ctx.theme.bandFill;
    doc.setFillColor(r, g, b);
    // margins.left, not cursor.x — cursor.x always equals margins.left in every existing case
    // (both only ever reset together), but only margins.left correctly follows a nested-table
    // child's indent (see renderNestedChild), since that overrides ctx.margins, not the cursor
    doc.rect(margins.left, cursor.y, contentWidth, bandHeight, 'F');

    const fontName = token.fontFamily ?? doc.getFont().fontName;
    applyTextStyle(doc, {
      ...token,
      fontStyle: this.styles.resolveSupportedFontStyle(doc, fontName, token.fontStyle),
      // the theme's on-band colour — a band must always set a colour explicitly, never inherit from the previous block
      color: token.color ?? ctx.theme.onBand,
    });

    const inset = 5 / doc.internal.scaleFactor; // mirrors AutoTable's cellPadding
    // nested group: indent the label according to depth, to make the hierarchy visible (bands are the same full width at every level)
    const indent = inset * 2 * depth;
    const lineHeight = lineHeightOf(doc, token.fontSize);
    drawText(doc, label, margins.left + inset + indent, cursor.y + lineHeight * 1.15);

    ctx.advanceY(bandHeight);
  }

  /**
   * columnStyles.halign only affects the body — head/foot need each column's alignment set per cell
   * full precedence: column conditionalStyle > table conditional > zebra > column-level (headerStyle/cellStyle) > row-type (Typography)
   * cellStyle is already merged into columnStyles before this point (see renderFlat/renderGrouped) —
   * this handles headerStyle (head section only, since columnStyles has no effect on head)
   * and zebra/conditional + the per-column conditionalStyle (body section only), which run last so
   * they override cellStyle; the per-column one is applied last as the most specific layer
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
        Object.assign(data.cell.styles, cellStyleToAutoTableStyles(column?.headerStyle));
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

      // per-column conditionalStyle — the most specific layer, applied on top of the table-level style
      const column = columns[data.column.index];
      if (column && 'conditionalStyle' in column && column.conditionalStyle) {
        const cellOverride = column.conditionalStyle(row);
        if (cellOverride) Object.assign(data.cell.styles, cellStyleToAutoTableStyles(cellOverride));
      }
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
