import { autoTable } from 'jspdf-autotable';
import type { FontStyle as AutoTableFontStyle, Styles, UserOptions } from 'jspdf-autotable';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { drawText } from '../core/draw-text';
import { KapomError } from '../core/errors';
import { lineHeightOf } from '../core/text-metrics';
import { normalizeText } from '../core/text-normalizer';
import { resolveRowStyle } from '../style/resolve-cell-style';
import {
  createSegmentState,
  DEFAULT_SUMMARY_LABEL,
  resolveAggregateRow,
  resolveSegmentBody,
  resolveTableContent,
  visibleColumns,
} from '../table/column-resolver';
import { computeColumnWidths } from '../table/column-width';
import {
  groupFooterLabel,
  groupHeaderLabel,
  splitGroups,
} from '../table/group-resolver';
import type { ResolvedAlign } from '../types/column';
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

interface GroupSegment<T> {
  label: string;
  rows: readonly T[];
  body: string[][];
  foot: string[] | undefined;
}

/** TextStyle (Typography token) → AutoTable Partial<Styles> — font family ไม่ set ถ้าไม่ระบุ (สืบทอดจาก styles.font base แทน) */
function tokenToAutoTableStyles(token: TextStyle): Partial<Styles> {
  const styles: Partial<Styles> = { fontSize: token.fontSize };
  if (token.fontStyle) styles.fontStyle = token.fontStyle;
  if (token.color) styles.textColor = [...token.color];
  if (token.fontFamily) styles.font = token.fontFamily;
  return styles;
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

export class TableBlock<T> implements MeasurableBlock {
  constructor(private readonly node: TableNode<T>) {
    if (node.nested) {
      throw new KapomError('nested table ยังไม่รองรับ — จะมาพร้อม group integration (roadmap)');
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

    if (!this.node.group) {
      return (1 + this.node.data.length + footRows) * rowHeight;
    }

    // grouped: ทุกกลุ่มมี band + head ของตัวเอง + subtotal (ถ้ามี aggregate) + grand total
    const groupCount = splitGroups(this.node.data, this.node.group).length;
    const bandHeight = lineHeight * GROUP_BAND_HEIGHT_RATIO;
    return (
      groupCount * (bandHeight + rowHeight + footRows * rowHeight) +
      this.node.data.length * rowHeight +
      footRows * rowHeight
    );
  }

  render(ctx: RenderContext): void {
    if (this.node.group) {
      this.renderGrouped(ctx, this.node.group);
    } else {
      this.renderFlat(ctx);
    }
  }

  // ── flat (ไม่ group) ────────────────────────────────────────────────

  private renderFlat(ctx: RenderContext): void {
    const content = resolveTableContent(this.node, ctx.numeric);
    const columnStyles: Record<string, Partial<Styles>> = {};
    content.aligns.forEach((align, index) => {
      const width = content.widths[index];
      columnStyles[String(index)] = {
        halign: align.data,
        ...(width !== undefined ? { cellWidth: width } : {}),
      };
    });

    this.runAutoTable(ctx, {
      head: [content.head],
      body: content.body,
      ...(content.foot ? { foot: [content.foot] } : {}),
      columnStyles,
      headStyles: this.resolveTokenStyles(ctx, ctx.typography.columnHeader),
      bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
      footStyles: this.resolveTokenStyles(ctx, ctx.typography.summary),
      didParseCell: this.cellHook(content.aligns, this.node.data, this.node.style),
    });
  }

  // ── grouped (composite: band + segment ต่อกลุ่ม + grand total) ──────

  private renderGrouped(ctx: RenderContext, resolver: GroupResolver<T>): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const head = columns.map((col) => normalizeText(col.header));
    const groups = splitGroups(this.node.data, resolver);
    const state = createSegmentState(columns.length);

    const segments: GroupSegment<T>[] = groups.map((group) => ({
      label: normalizeText(groupHeaderLabel(resolver, group.key, group.rows)),
      rows: group.rows,
      body: resolveSegmentBody(columns, group.rows, ctx.numeric, state),
      foot: resolveAggregateRow(
        columns,
        group.rows,
        ctx.numeric,
        groupFooterLabel(resolver, group.key, group.rows),
      ),
    }));
    const grandFoot = resolveAggregateRow(
      columns,
      this.node.data,
      ctx.numeric,
      this.node.summaryLabel ?? DEFAULT_SUMMARY_LABEL,
    );

    // fix column widths ชุดเดียวจากเนื้อหาทุกกลุ่ม — เส้น column ตรงกันข้าม segment
    const allRows: (readonly string[])[] = [
      head,
      ...segments.flatMap((seg) => (seg.foot ? [...seg.body, seg.foot] : seg.body)),
      ...(grandFoot ? [grandFoot] : []),
    ];
    const widths = computeColumnWidths(
      ctx.doc,
      allRows,
      columns.map((col) => col.width),
      ctx.contentWidth,
    );

    const columnStyles: Record<string, Partial<Styles>> = {};
    aligns.forEach((align, index) => {
      columnStyles[String(index)] = {
        halign: align.data,
        cellWidth: widths[index] ?? 'auto',
      };
    });

    const lineHeight = lineHeightOf(ctx.doc, ctx.typography.detailRow.fontSize);
    const bandHeight = lineHeight * GROUP_BAND_HEIGHT_RATIO;
    const rowEstimate = lineHeight * ESTIMATED_ROW_HEIGHT_RATIO;
    const minRows = resolver.keepTogether?.minRowsWithHeader ?? 1;

    for (const segment of segments) {
      // keep-together: band + head + N แถวแรกต้องอยู่หน้าเดียวกัน ไม่งั้น break ก่อนวาด band
      const required =
        bandHeight +
        rowEstimate +
        Math.min(minRows, segment.body.length) * rowEstimate;
      ctx.ensureSpace(required);

      this.drawGroupBand(ctx, segment.label, bandHeight);
      this.runAutoTable(ctx, {
        head: [head],
        body: segment.body,
        ...(segment.foot ? { foot: [segment.foot] } : {}),
        columnStyles,
        headStyles: this.resolveTokenStyles(ctx, ctx.typography.columnHeader),
        bodyStyles: this.resolveTokenStyles(ctx, ctx.typography.detailRow),
        footStyles: this.resolveTokenStyles(ctx, ctx.typography.groupFooter),
        didParseCell: this.cellHook(aligns, segment.rows, this.node.style),
      });
    }

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

  private drawGroupBand(ctx: RenderContext, label: string, bandHeight: number): void {
    const { doc, cursor, contentWidth } = ctx;
    const token = ctx.typography.groupHeader;
    const [r, g, b] = GROUP_BAND_FILL;
    doc.setFillColor(r, g, b);
    doc.rect(cursor.x, cursor.y, contentWidth, bandHeight, 'F');

    doc.setFontSize(token.fontSize);
    const fontName = token.fontFamily ?? doc.getFont().fontName;
    doc.setFont(fontName, this.resolveSupportedFontStyle(doc, fontName, token.fontStyle));
    const [tr, tg, tb] = token.color ?? [0, 0, 0];
    doc.setTextColor(tr, tg, tb);

    const inset = 5 / doc.internal.scaleFactor; // ล้อ cellPadding ของ AutoTable
    const lineHeight = lineHeightOf(doc, token.fontSize);
    drawText(doc, label, cursor.x + inset, cursor.y + lineHeight * 1.15);

    ctx.advanceY(bandHeight);
  }

  // ── style resolution ──────────────────────────────────────────────────

  /** Typography token → AutoTable styles พร้อม fallback fontStyle ถ้า font ที่ใช้ไม่มี variant นั้นจริง */
  private resolveTokenStyles(ctx: RenderContext, token: TextStyle): Partial<Styles> {
    const styles = tokenToAutoTableStyles(token);
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
  private resolveSupportedFontStyle(
    doc: RenderContext['doc'],
    fontName: string,
    requested: AutoTableFontStyle | undefined,
  ): AutoTableFontStyle {
    if (!requested || requested === 'normal') return 'normal';
    const available = doc.getFontList()[fontName] ?? [];
    return available.includes(requested) ? requested : 'normal';
  }

  /** columnStyles.halign มีผลแค่ body — head/foot ต่าง column ต้อง set ราย cell; body ยังทับด้วย zebra/conditional (ตาม precedence) */
  private cellHook(
    aligns: readonly ResolvedAlign[],
    rows: readonly T[],
    styleOptions: TableStyleOptions<T> | undefined,
  ): NonNullable<UserOptions['didParseCell']> {
    return (data) => {
      const align = aligns[data.column.index];
      if (align) {
        if (data.section === 'head') data.cell.styles.halign = align.header;
        if (data.section === 'foot') data.cell.styles.halign = align.data;
      }

      if (data.section !== 'body') return;
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

  /** เรียก autoTable ที่ตำแหน่ง cursor แล้ว sync cursor ตาม doc หลังวาด */
  private runAutoTable(ctx: RenderContext, options: UserOptions): void {
    autoTable(ctx.doc, {
      startY: ctx.cursor.y,
      // margin ทั้งสี่ด้าน — AutoTable ใช้ top เป็นจุดเริ่มของหน้าถัดไปเวลาแบ่งหน้าเอง
      margin: {
        top: ctx.margins.top,
        right: ctx.margins.right,
        bottom: ctx.margins.bottom,
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
        'AutoTable ไม่ได้ตั้ง lastAutoTable.finalY หลัง render — ตรวจ jspdf-autotable version',
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
