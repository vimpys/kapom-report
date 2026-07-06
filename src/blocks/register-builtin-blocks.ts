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

let registered = false;

/**
 * built-in blocks ลงทะเบียนผ่าน registry API เดียวกับที่ plugin ใช้ (ไม่มีสิทธิพิเศษ)
 * เป็น named function ไม่ใช่ side-effect import — bundler ที่เห็น `sideEffects: false`
 * จะตัด bare import ทิ้งได้เงียบๆ (เจอจริงตอน bundle ฝั่ง browser: esbuild เตือน
 * "Ignoring this import" → createBlock throw ไม่รู้จัก type ทุกตัวตอน runtime);
 * การเรียกฟังก์ชันตรงๆ จาก create-block.ts เป็น side effect ใน module ที่ถูกใช้งานจริง
 * bundler ตัดไม่ได้; idempotent — เรียกซ้ำเป็น no-op (registerBlockType throw ถ้าชื่อซ้ำ)
 */
export function registerBuiltinBlocks(): void {
  if (registered) return;
  registered = true;

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
}
