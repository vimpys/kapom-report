import { autoTable } from 'jspdf-autotable';
import type { Styles, UserOptions } from 'jspdf-autotable';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomError } from '../core/errors';
import { lineHeightOf } from '../core/text-metrics';
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
import type { GroupResolver, TableNode } from '../types/node';
import type { RGB } from '../types/primitives';

/** default ของ AutoTable — ใช้ประเมินความสูงตอน measure เท่านั้น */
const AUTOTABLE_DEFAULT_FONT_SIZE = 10;
/** row สูง ≈ line-height + cellPadding บนล่างของ AutoTable — สัดส่วนโดยประมาณ */
const ESTIMATED_ROW_HEIGHT_RATIO = 1.9;
/** แถบ group header สูงเป็นสัดส่วนของ line-height */
const GROUP_BAND_HEIGHT_RATIO = 1.6;

const GROUP_BAND_FILL: RGB = [236, 240, 241];
const GRAND_TOTAL_FILL: RGB = [41, 128, 185];
const GRAND_TOTAL_TEXT: RGB = [255, 255, 255];

interface GroupSegment {
  label: string;
  body: string[][];
  foot: string[] | undefined;
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
    const lineHeight = ctx.measureText('X', AUTOTABLE_DEFAULT_FONT_SIZE, ctx.contentWidth);
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
      didParseCell: this.alignHook(content.aligns),
    });
  }

  // ── grouped (composite: band + segment ต่อกลุ่ม + grand total) ──────

  private renderGrouped(ctx: RenderContext, resolver: GroupResolver<T>): void {
    const columns = visibleColumns(this.node.columns);
    const aligns = columns.map(resolveColumnAlign);
    const head = columns.map((col) => col.header);
    const groups = splitGroups(this.node.data, resolver);
    const state = createSegmentState(columns.length);

    const segments: GroupSegment[] = groups.map((group) => ({
      label: groupHeaderLabel(resolver, group.key, group.rows),
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

    const lineHeight = lineHeightOf(ctx.doc, AUTOTABLE_DEFAULT_FONT_SIZE);
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

      this.drawGroupBand(ctx, segment.label, bandHeight, lineHeight);
      this.runAutoTable(ctx, {
        head: [head],
        body: segment.body,
        ...(segment.foot ? { foot: [segment.foot] } : {}),
        columnStyles,
        didParseCell: this.alignHook(aligns),
      });
    }

    if (grandFoot) {
      ctx.ensureSpace(rowEstimate);
      // grand total เป็น body แถวเดียวสไตล์เข้ม — ไม่ใช้ foot ของ AutoTable
      // เพราะตารางที่มีแต่ foot ไม่มี body เป็น edge case ที่ lib ไม่การันตี
      this.runAutoTable(ctx, {
        body: [grandFoot],
        columnStyles,
        bodyStyles: {
          fontStyle: 'bold',
          fillColor: [...GRAND_TOTAL_FILL],
          textColor: [...GRAND_TOTAL_TEXT],
        },
        didParseCell: this.alignHook(aligns),
      });
    }
  }

  private drawGroupBand(
    ctx: RenderContext,
    label: string,
    bandHeight: number,
    lineHeight: number,
  ): void {
    const { doc, cursor, contentWidth } = ctx;
    const [r, g, b] = GROUP_BAND_FILL;
    doc.setFillColor(r, g, b);
    doc.rect(cursor.x, cursor.y, contentWidth, bandHeight, 'F');

    doc.setFontSize(AUTOTABLE_DEFAULT_FONT_SIZE);
    doc.setFont(doc.getFont().fontName, 'bold');
    doc.setTextColor(0, 0, 0);
    const inset = 5 / doc.internal.scaleFactor; // ล้อ cellPadding ของ AutoTable
    doc.text(label, cursor.x + inset, cursor.y + lineHeight * 1.15);

    ctx.advanceY(bandHeight);
  }

  // ── shared ──────────────────────────────────────────────────────────

  /** columnStyles.halign มีผลแค่ body — head/foot ต่าง column ต้อง set ราย cell */
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
      ...options,
    });

    const finalY = ctx.doc.lastAutoTable?.finalY;
    if (typeof finalY !== 'number') {
      throw new KapomError(
        'AutoTable ไม่ได้ตั้ง lastAutoTable.finalY หลัง render — ตรวจ jspdf-autotable version',
      );
    }
    // AutoTable แบ่งหน้าเอง → doc อาจอยู่คนละหน้ากับ cursor แล้ว ต้อง sync กลับ
    const pageIndex = ctx.doc.getCurrentPageInfo().pageNumber - 1;
    ctx.syncCursor(pageIndex, finalY);
  }

  private hasAggregate(): boolean {
    return this.node.columns.some(
      (col) => (col.type === 'data' || col.type === 'computed') && col.aggregate !== undefined,
    );
  }
}
