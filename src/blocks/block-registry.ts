import type { MeasurableBlock } from '../core/context';
import { KapomError } from '../core/errors';
import type { ReportNode, ReportNodeInput } from '../types/node';
import { resolveNodeInput } from '../types/node';

/**
 * T ที่นี่คือ boundary จริง — registry เก็บ factory ของหลาย node variant ปนกัน
 * (TextNode, TableNode<Sale>, TableNode<Order>, ...) ไม่มีทางประกาศ type เดียวที่ตรงทุกตัว
 * แคบ narrow กลับที่จุด register ของแต่ละ built-in/plugin เอง (ดู register-builtin-blocks.ts)
 */
export type BlockFactory = (node: ReportNode<unknown>) => MeasurableBlock;

const registry = new Map<string, BlockFactory>();

/**
 * ลงทะเบียน block type ใหม่ — core ไม่ต้องแก้เพื่อเพิ่ม type (Open/Closed)
 * ชื่อซ้ำ → throw ทันที ไม่ silent overwrite (กัน plugin ทับ built-in โดยไม่ตั้งใจ)
 */
export function registerBlockType(type: string, factory: BlockFactory): void {
  if (registry.has(type)) {
    throw new KapomError(
      `Block type '${type}' is already registered — check for duplicate registration or a name clash with a built-in`,
    );
  }
  registry.set(type, factory);
}

/**
 * แปลง node หนึ่งตัวเป็น MeasurableBlock ผ่าน registry ที่ลงทะเบียนไว้ —
 * รับ text shorthand (string / object ไม่ใส่ `type`) แล้ว normalize ก่อน dispatch เสมอ
 */
export function createBlock<T>(input: ReportNodeInput<T>): MeasurableBlock {
  const node = resolveNodeInput(input);
  const factory = registry.get(node.type);
  if (!factory) {
    throw new KapomError(
      `Block type '${node.type}' is not registered (see roadmap in CLAUDE.md)`,
    );
  }
  return factory(node as ReportNode<unknown>);
}
