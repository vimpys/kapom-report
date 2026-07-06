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

/** row สูง ≈ line-height + cellPadding บนล่างของ AutoTable — สัดส่วนโดยประมาณ */
const ESTIMATED_ROW_HEIGHT_RATIO = 1.9;
/** แถบ group header สูงเป็นสัดส่วนของ line-height */
const GROUP_BAND_HEIGHT_RATIO = 1.6;

/** พื้นหลัง band/grand-total เป็น convention ของ composite pattern นี้เอง — ยังไม่เปิดให้ theme override (ดู CLAUDE.md) */
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

/** ดึง string จาก cell ของ AutoTable — รองรับทั้ง string ตรงและ CellDef object ({content}, เช่น no-data colSpan row) */
function cellStringContent(cell: unknown): string | undefined {
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'object' && cell !== null && 'content' in cell) {
    const { content } = cell as { content?: unknown };
    if (typeof content === 'string') return content;
  }
  return undefined;
}

/** TextStyle (Typography token / column-level headerStyle/cellStyle) → AutoTable Partial<Styles> — font family ไม่ set ถ้าไม่ระบุ (สืบทอดจาก styles.font base แทน) */
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
   * ค่าประมาณ ไม่ใช่ค่าเป๊ะ — ใช้แค่ตัดสินใจว่าควร break ก่อนเริ่มตารางไหม
   * (wrap ในเซลล์/สไตล์จริงรู้ตอน AutoTable วาด); ตารางที่ยาวเกินหน้า
   * AutoTable แบ่งหน้าภายในเองอยู่แล้ว engine ไม่ต้องรู้ความสูงจริง
   */
  measureHeight(ctx: MeasureContext): number {
    const fontSize = ctx.typography.detailRow.fontSize;
    const lineHeight = ctx.measureText('X', fontSize, ctx.contentWidth);
    const rowHeight = lineHeight * ESTIMATED_ROW_HEIGHT_RATIO;
    const footRows = this.hasAggregate() ? 1 : 0;

    // No-Data fallback: head + แถวข้อความเดียว
    if (this.node.data.length === 0) return 2 * rowHeight;

    if (!this.node.group) {
      return (1 + this.node.data.length + footRows) * rowHeight;
    }

    // grouped: ทุกกลุ่มทุกระดับมี band + subtotal (ถ้ามี aggregate); leaf segment มี head ของตัวเอง
    // countGroupBands นับรวมทุกระดับของ subGroup chain (nested group, roadmap 10)
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

  // ── No-Data fallback (data ว่าง — ค้างแก้ #5) ────────────────────────

  /** หัวตาราง + แถวข้อความเดียว colSpan เต็มความกว้าง — แทนหัวตารางเปล่าเงียบๆ แบบเดิม */
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
   * columnStyles ต่อ index: halign + fix width + column-level cellStyle — cellStyle ต้องมาก่อน
   * didParseCell เสมอ (zebra/conditional apply ทีหลังจึงทับได้ตาม precedence ที่ล็อกไว้)
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

  // ── flat (ไม่ group) ────────────────────────────────────────────────

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

  // ── grouped (composite: band + segment ต่อกลุ่ม + grand total; recursive เมื่อมี subGroup) ──────

  private renderGrouped(ctx: RenderContext, resolver: GroupResolver<T>): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const head = columns.map((col) => normalizeText(col.header));
    const state = createSegmentState(columns.length);

    // tree ครอบทุกระดับของ subGroup chain — leaf มี body, non-leaf มี children (roadmap 10)
    const tree = buildGroupTree(columns, this.node.data, resolver, ctx.numeric, state);
    const grandFoot = resolveAggregateRow(
      columns,
      this.node.data,
      ctx.numeric,
      this.node.summaryLabel ?? DEFAULT_SUMMARY_LABEL,
    );

    // fix column widths ชุดเดียวจากเนื้อหาทุกกลุ่มทุกระดับ — เส้น column ตรงกันข้าม segment
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
      ctx.typography.detailRow.fontSize, // วัดที่ fontSize เดียวกับ body จริง (ค้างแก้ #3)
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
      // grand total เป็น body แถวเดียวสไตล์เข้ม — ไม่ใช้ foot ของ AutoTable
      // เพราะตารางที่มีแต่ foot ไม่มี body เป็น edge case ที่ lib ไม่การันตี
      this.runAutoTable(ctx, {
        // 'striped' (default theme) ตั้ง alternateRow.fillColor ให้ body row index คู่เสมอ
        // (แถวนี้มีแถวเดียว = index 0 = คู่เสมอ) แล้ว merge ทับ bodyStyles.fillColor ของเราแบบเงียบๆ
        // (สังเกตได้ตอนตรวจ demo จริง — พื้นหลังจางเป็นสีเทาแทนที่จะเป็นสีน้ำเงินที่ตั้งใจ)
        // 'plain' ไม่นิยาม alternateRow เลยเป็นค่า default → ตัดปัญหานี้ทิ้ง
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

  /** context คงที่ที่ส่งลงทุกชั้นของ renderGroupTree (คำนวณครั้งเดียวใน renderGrouped) */
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
      // keep-together: band (+band ลูกซ้อนลงไปจนถึง leaf) + head + N แถวแรกต้องอยู่หน้าเดียวกัน
      ctx.ensureSpace(this.requiredSpaceFor(node, shared.bandHeight, shared.rowEstimate));
      this.drawGroupBand(ctx, node.label, shared.bandHeight, node.depth);

      if (node.children) {
        this.renderGroupTree(ctx, node.children, shared);
        // subtotal ระดับ non-leaf ไม่มี segment ให้ฝากเป็น foot — วาดเป็นแถวเดี่ยวแยก
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

  /** พื้นที่ขั้นต่ำก่อนวาด band ของ node นี้ — non-leaf ต้องเผื่อ band ลูกซ้อนลงไปจนถึง leaf แรก */
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
   * subtotal ของกลุ่ม non-leaf (nested group) — แถวเดี่ยว theme 'plain' เหตุผลเดียวกับ grand total
   * (foot-only table เป็น edge case ที่ AutoTable ไม่การันตี + กัน alternateRow ทับ fillColor);
   * ใช้พื้น GROUP_BAND_FILL เดียวกับ band ให้จับคู่กับหัวกลุ่มทางสายตา ต่างจาก grand total สีเข้ม
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
      color: token.color ?? [0, 0, 0], // band ต้องได้สีดำ default เสมอ ไม่สืบสีจาก block ก่อนหน้า
    });

    const inset = 5 / doc.internal.scaleFactor; // ล้อ cellPadding ของ AutoTable
    // nested group: indent label ตามชั้นให้เห็นลำดับชั้น (band เต็มความกว้างเท่ากันทุกระดับ)
    const indent = inset * 2 * depth;
    const lineHeight = lineHeightOf(doc, token.fontSize);
    drawText(doc, label, cursor.x + inset + indent, cursor.y + lineHeight * 1.15);

    ctx.advanceY(bandHeight);
  }

  // ── style resolution ──────────────────────────────────────────────────

  /** Typography token → AutoTable styles พร้อม fallback fontStyle ถ้า font ที่ใช้ไม่มี variant นั้นจริง */
  private resolveTokenStyles(ctx: RenderContext, token: TextStyle): Partial<Styles> {
    const styles = partialTextStyleToAutoTableStyles(token);
    if (styles.fontStyle) {
      const fontName = styles.font ?? ctx.doc.getFont().fontName;
      styles.fontStyle = this.resolveSupportedFontStyle(ctx.doc, fontName, styles.fontStyle);
    }
    return styles;
  }

  /**
   * ทุก built-in theme ของ AutoTable ตั้ง head/foot เป็น 'bold' โดย default — ถ้า font
   * ที่ใช้ไม่มี variant นั้นลงทะเบียนไว้ jsPDF จะ warn เงียบๆ แล้ว fallback (silent failure
   * ที่ decision เรื่อง font บอกไว้ว่าต้องกันเอง) เช็คจาก getFontList ก่อนใช้เสมอ
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
   * columnStyles.halign มีผลแค่ body — head/foot ต่าง column ต้อง set ราย cell
   * precedence เต็ม: conditional > zebra > column-level (headerStyle/cellStyle) > row-type (Typography)
   * cellStyle ถูก merge เข้า columnStyles ไปแล้วก่อนถึงจุดนี้ (ดู renderFlat/renderGrouped) —
   * ที่นี่จัดการ headerStyle (head section เท่านั้น เพราะ columnStyles ไม่มีผลกับ head)
   * กับ zebra/conditional (body section เท่านั้น) ซึ่งต้องมาทีหลังสุดเพื่อทับ cellStyle ได้
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

  /** align เท่านั้น — ใช้กับ grand total ที่ไม่มี typed row ต้นทางให้ resolveRowStyle อ้างอิง */
  private alignHook(aligns: readonly ResolvedAlign[]): NonNullable<UserOptions['didParseCell']> {
    return (data) => {
      const align = aligns[data.column.index];
      if (!align) return;
      if (data.section === 'head') data.cell.styles.halign = align.header;
      if (data.section === 'foot') data.cell.styles.halign = align.data;
    };
  }

  /**
   * fail-fast กัน silent mojibake ใน cell — AutoTable วาด cell เองข้าม drawText facade
   * (guard ใน drawText จับไม่ได้) ต้อง scan เองก่อนส่งเข้า autoTable; เช็ค font ครั้งเดียว
   * นอก loop — user ที่ลงทะเบียน font แล้ว (ทางปกติ) ข้าม scan ทั้งก้อนไม่มีต้นทุน
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

  /** เรียก autoTable ที่ตำแหน่ง cursor แล้ว sync cursor ตาม doc หลังวาด */
  private runAutoTable(ctx: RenderContext, options: UserOptions): void {
    this.assertThaiCellsRenderable(ctx, options);
    const pageHeight = ctx.doc.internal.pageSize.getHeight();
    autoTable(ctx.doc, {
      startY: ctx.cursor.y,
      // margin.top/bottom ต้องใช้ contentTop/contentBottom (หัก page header/footer reserved แล้ว)
      // ไม่ใช่ margins ดิบ — ไม่งั้น AutoTable เวลาแบ่งหน้าเองจะวาดทับโซน band
      margin: {
        top: ctx.contentTop,
        right: ctx.margins.right,
        bottom: pageHeight - ctx.contentBottom,
        left: ctx.margins.left,
      },
      // AutoTable มี default font 'helvetica' ของตัวเอง ไม่สืบทอดจาก doc.getFont() —
      // ต้องส่ง font ปัจจุบันของ doc ตรงๆ ไม่งั้น font ไทยที่ลงทะเบียนไว้จะไม่มีผลกับตาราง
      styles: { font: ctx.doc.getFont().fontName },
      ...options,
    });

    const finalY = ctx.doc.lastAutoTable?.finalY;
    if (typeof finalY !== 'number') {
      throw new KapomError(
        'AutoTable did not set lastAutoTable.finalY after render — check the jspdf-autotable version',
      );
    }
    // AutoTable แบ่งหน้าเอง → doc อาจไปอยู่คนละหน้ากับ cursor แล้ว ต้อง sync กลับ
    const pageIndex = ctx.doc.getCurrentPageInfo().pageNumber - 1;
    ctx.syncCursor(pageIndex, finalY);
  }

  private hasAggregate(): boolean {
    return this.node.columns.some(
      (col) => (col.type === 'data' || col.type === 'computed') && col.aggregate !== undefined,
    );
  }
}
