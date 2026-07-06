import { createBlock, registerBlockType } from './block-registry';
import { TextBlock } from './text-block';
import { SpacerBlock } from './spacer-block';
import { DividerBlock } from './divider-block';
import { ImageBlock } from './image-block';
import { SignatureBlock } from './signature-block';
import { TableBlock } from './table-block';
import { StackBlock } from './stack-block';
import { SectionBlock } from './section-block';
import { RawBlock } from './raw-block';
import type {
  DividerNode,
  ImageNode,
  RawNode,
  SectionNode,
  SignatureNode,
  SpacerNode,
  StackNode,
  TableNode,
  TextNode,
} from '../types/node';

let registered = false;

/**
 * Built-in blocks register through the same registry API a plugin would use (no special
 * privilege). This is a named function, not a side-effect import — a bundler that sees
 * `sideEffects: false` can silently drop a bare import (seen for real when bundling for the
 * browser: esbuild warns "Ignoring this import" → createBlock then throws "unknown type" for
 * every type at runtime). Calling the function directly from create-block.ts is a side effect
 * inside a module whose exports are actually used, which a bundler can't drop; idempotent —
 * calling it again is a no-op (registerBlockType throws on a duplicate name).
 */
export function registerBuiltinBlocks(): void {
  if (registered) return;
  registered = true;

  registerBlockType('text', (node) => new TextBlock(node as TextNode));
  registerBlockType('spacer', (node) => new SpacerBlock(node as SpacerNode));
  registerBlockType('divider', (node) => new DividerBlock(node as DividerNode));
  registerBlockType('image', (node) => new ImageBlock(node as ImageNode));
  registerBlockType('signature', (node) => new SignatureBlock(node as SignatureNode));
  registerBlockType('raw', (node) => new RawBlock(node as RawNode));
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
