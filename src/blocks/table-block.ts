import { autoTable } from 'jspdf-autotable';
import type { Styles, UserOptions } from 'jspdf-autotable';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomError } from '../core/errors';
import { resolveTableContent } from '../table/column-resolver';
import type { ResolvedTableContent } from '../table/column-resolver';
import type { TableNode } from '../types/node';

/** default ของ AutoTable — ใช้ประเมินความสูงตอน measure เท่านั้น */
const AUTOTABLE_DEFAULT_FONT_SIZE = 10;
/** row สูง ≈ line-height + cellPadding บนล่างของ AutoTable — สัดส่วนโดยประมาณ */
const ESTIMATED_ROW_HEIGHT_RATIO = 1.9;

export class TableBlock<T> implements MeasurableBlock {
  constructor(private readonly node: TableNode<T>) {
    if (node.nested) {
      throw new KapomError('nested table ยังไม่รองรับ — จะมาพร้อม group integration (roadmap)');
    }
    if (node.group) {
      throw new KapomError('group ยังไม่รองรับ — roadmap ขั้น 3 (Group block)');
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
    return (1 + this.node.data.length + footRows) * rowHeight;
  }

  render(ctx: RenderContext): void {
    const content = resolveTableContent(this.node, ctx.numeric);

    autoTable(ctx.doc, this.buildOptions(ctx, content));

    const finalY = ctx.doc.lastAutoTable?.finalY;
    if (typeof finalY !== 'number') {
      throw new KapomError('AutoTable ไม่ได้ตั้ง lastAutoTable.finalY หลัง render — ตรวจ jspdf-autotable version');
    }
    // AutoTable แบ่งหน้าเอง → doc อาจอยู่คนละหน้ากับ cursor แล้ว ต้อง sync กลับ
    const pageIndex = ctx.doc.getCurrentPageInfo().pageNumber - 1;
    ctx.syncCursor(pageIndex, finalY);
  }

  private buildOptions(ctx: RenderContext, content: ResolvedTableContent): UserOptions {
    const columnStyles: Record<string, Partial<Styles>> = {};
    content.aligns.forEach((align, index) => {
      const width = content.widths[index];
      columnStyles[String(index)] = {
        halign: align.data,
        ...(width !== undefined ? { cellWidth: width } : {}),
      };
    });

    return {
      startY: ctx.cursor.y,
      // margin ทั้งสี่ด้าน — AutoTable ใช้ top เป็นจุดเริ่มของหน้าถัดไปเวลาแบ่งหน้าเอง
      margin: {
        top: ctx.margins.top,
        right: ctx.margins.right,
        bottom: ctx.margins.bottom,
        left: ctx.margins.left,
      },
      head: [content.head],
      body: content.body,
      ...(content.foot ? { foot: [content.foot] } : {}),
      columnStyles,
      // columnStyles.halign มีผลแค่ body — head/foot ต่าง column ต้อง set ราย cell ที่นี่
      didParseCell: (data) => {
        const align = content.aligns[data.column.index];
        if (!align) return;
        if (data.section === 'head') data.cell.styles.halign = align.header;
        if (data.section === 'foot') data.cell.styles.halign = align.data;
      },
    };
  }

  private hasAggregate(): boolean {
    return this.node.columns.some(
      (col) => (col.type === 'data' || col.type === 'computed') && col.aggregate !== undefined,
    );
  }
}
