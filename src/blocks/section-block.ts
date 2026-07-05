import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { StackBlock } from './stack-block';

/**
 * เหมือน StackBlock ทุกประการ (render ลูกตามลำดับ) แต่เก็บ `name` ไว้อ้างอิง —
 * ยังไม่ใช้ตอน render (รอ Report Registry เลือก section ด้วยชื่อ, roadmap 6c)
 */
export class SectionBlock implements MeasurableBlock {
  private readonly stack: StackBlock;

  constructor(
    readonly name: string,
    children: readonly MeasurableBlock[],
    private readonly breakBefore: boolean = false,
  ) {
    this.stack = new StackBlock(children);
  }

  measureHeight(ctx: MeasureContext): number {
    return this.stack.measureHeight(ctx);
  }

  render(ctx: RenderContext): void {
    if (this.breakBefore) {
      ctx.forcePageBreak();
    }
    this.stack.render(ctx);
  }
}
