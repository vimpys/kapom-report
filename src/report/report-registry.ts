import { KapomError } from '../core/errors';
import type { SectionNode } from '../types/node';

/** สร้าง SectionNode จาก shared context (เช่น hotel name/date) — เรียกตอน build() เท่านั้น */
export type SectionBuilder<C> = (context: C) => SectionNode<unknown>;

/**
 * ประกอบ Composite Report จากหลาย section ที่เลือกด้วยชื่อ (roadmap 6c) — instance ต่อ report
 * (ต่าง block-registry ที่เป็น global singleton สำหรับ block *type*: section เป็นเนื้อหาเฉพาะ
 * รายงานนั้นๆ ไม่ใช่ extensibility point ของ lib จึงไม่ควรแชร์ state ข้ามรายงาน)
 * shared context (เช่น hotel name/date) inject ตอน build() ครั้งเดียว ให้ทุก section builder
 * เห็นค่าเดียวกัน; ผลลัพธ์เป็น SectionNode[] ตรงกับ ReportNode tree ทั่วไป — caller ผ่าน createBlock
 * แล้วส่งเข้า RenderEngine.render() เหมือน node อื่นๆ
 */
export class ReportRegistry<C> {
  private readonly builders = new Map<string, SectionBuilder<C>>();

  /**
   * ลงทะเบียน section ด้วยชื่อ — ชื่อซ้ำ throw ทันที กัน builder ทับกันโดยไม่ตั้งใจ (silent overwrite)
   * generic T ที่นี่ให้แต่ละ builder คืน `SectionNode<Sale>`/`SectionNode<Expense>` ที่เป็นรูปธรรมได้ตรงๆ
   * (ไม่ต้อง annotate `SectionNode<unknown>` เอง) — `TableNode<T>` invariant ใน T (เช่น `key: keyof T`
   * กลาย `never` ถ้า T เป็น `unknown` ตรงๆ) เก็บเป็น `unknown` ภายในเป็น boundary จุดเดียว เหมือน
   * `BlockFactory` ใน block-registry.ts
   */
  register<T>(name: string, builder: (context: C) => SectionNode<T>): void {
    if (this.builders.has(name)) {
      throw new KapomError(`ReportRegistry: section '${name}' ลงทะเบียนซ้ำ`);
    }
    this.builders.set(name, builder as unknown as SectionBuilder<C>);
  }

  /** ประกอบ section ตามลำดับชื่อที่ระบุ — ชื่อที่ไม่เคย register throw ทันที (fail-fast ไม่ silent skip) */
  build(order: readonly string[], context: C): SectionNode<unknown>[] {
    return order.map((name) => {
      const builder = this.builders.get(name);
      if (!builder) {
        throw new KapomError(`ReportRegistry: ไม่พบ section '${name}' ที่ลงทะเบียนไว้`);
      }
      return builder(context);
    });
  }
}
