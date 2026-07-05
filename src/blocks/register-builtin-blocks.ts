import { createBlock, registerBlockType } from './block-registry';
import { TextBlock } from './text-block';
import { SpacerBlock } from './spacer-block';
import { DividerBlock } from './divider-block';
import { ImageBlock } from './image-block';
import { SignatureBlock } from './signature-block';
import { TableBlock } from './table-block';
import { StackBlock } from './stack-block';
import { SectionBlock } from './section-block';
import type {
  DividerNode,
  ImageNode,
  SectionNode,
  SignatureNode,
  SpacerNode,
  StackNode,
  TableNode,
  TextNode,
} from '../types/node';

/**
 * built-in blocks ลงทะเบียนตัวเองผ่าน registry API เดียวกับที่ plugin ใช้ (ไม่มีสิทธิพิเศษ)
 * import ไฟล์นี้ (จาก create-block.ts) คือจุดเดียวที่รับประกันว่า built-in ลงทะเบียนแล้วก่อนใช้งาน
 */
registerBlockType('text', (node) => new TextBlock(node as TextNode));
registerBlockType('spacer', (node) => new SpacerBlock(node as SpacerNode));
registerBlockType('divider', (node) => new DividerBlock(node as DividerNode));
registerBlockType('image', (node) => new ImageBlock(node as ImageNode));
registerBlockType('signature', (node) => new SignatureBlock(node as SignatureNode));
registerBlockType('table', (node) => new TableBlock(node as TableNode<unknown>));
registerBlockType('stack', (node) => {
  const stackNode = node as StackNode<unknown>;
  return new StackBlock(stackNode.children.map((child) => createBlock(child)));
});
registerBlockType('section', (node) => {
  const sectionNode = node as SectionNode<unknown>;
  return new SectionBlock(
    sectionNode.name,
    sectionNode.children.map((child) => createBlock(child)),
    sectionNode.breakBefore ?? false,
  );
});
