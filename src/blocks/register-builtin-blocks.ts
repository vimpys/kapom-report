import { registerBlockType } from './block-registry';
import { TextBlock } from './text-block';
import { SpacerBlock } from './spacer-block';
import { DividerBlock } from './divider-block';
import { ImageBlock } from './image-block';
import { TableBlock } from './table-block';
import type { DividerNode, ImageNode, SpacerNode, TableNode, TextNode } from '../types/node';

/**
 * built-in blocks ลงทะเบียนตัวเองผ่าน registry API เดียวกับที่ plugin ใช้ (ไม่มีสิทธิพิเศษ)
 * import ไฟล์นี้ (จาก create-block.ts) คือจุดเดียวที่รับประกันว่า built-in ลงทะเบียนแล้วก่อนใช้งาน
 */
registerBlockType('text', (node) => new TextBlock(node as TextNode));
registerBlockType('spacer', (node) => new SpacerBlock(node as SpacerNode));
registerBlockType('divider', (node) => new DividerBlock(node as DividerNode));
registerBlockType('image', (node) => new ImageBlock(node as ImageNode));
registerBlockType('table', (node) => new TableBlock(node as TableNode<unknown>));
