import type { MeasurableBlock } from '../core/context';
import { KapomError } from '../core/errors';
import type { ReportNode } from '../types/node';
import { TextBlock } from './text-block';
import { SpacerBlock } from './spacer-block';
import { DividerBlock } from './divider-block';

/**
 * แปลง ReportNode หนึ่ง node เป็น MeasurableBlock ที่ render ได้
 * ยังไม่รองรับ image/table/group/raw/stack/section — ดู roadmap ใน CLAUDE.md (ขั้น 2b เป็นต้นไป)
 */
export function createBlock<T>(node: ReportNode<T>): MeasurableBlock {
  switch (node.type) {
    case 'text':
      return new TextBlock(node);
    case 'spacer':
      return new SpacerBlock(node);
    case 'divider':
      return new DividerBlock(node);
    default:
      throw new KapomError(
        `Block type '${node.type}' ยังไม่รองรับ (ดู roadmap ใน CLAUDE.md)`,
      );
  }
}
