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
import { assertConfinedChildAllowed, assertRowNodeValid, DEFAULT_ROW_GAP, RowBlock } from './row-block';
import { KeyValueBlock } from './key-value-block';
import { assertBoxNodeValid, BoxBlock, DEFAULT_BOX_BORDER_WIDTH, DEFAULT_BOX_PADDING } from './box-block';
import type {
  BoxNode,
  DividerNode,
  ImageNode,
  KeyValueNode,
  RawNode,
  RowNode,
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
  registerBlockType('row', (node) => {
    const rowNode = node as RowNode<unknown>;
    assertRowNodeValid(rowNode); // fail-fast before building children (validates widths/gap + rejects table/section)
    return new RowBlock(
      rowNode.columns.map((column) => ({
        width: column.width,
        blocks: column.children.map((child) => createBlock(child)),
      })),
      rowNode.gap ?? DEFAULT_ROW_GAP,
    );
  });
  registerBlockType('keyValue', (node) => new KeyValueBlock(node as KeyValueNode));
  registerBlockType('box', (node) => {
    const boxNode = node as BoxNode<unknown>;
    assertBoxNodeValid(boxNode);
    for (const child of boxNode.children) assertConfinedChildAllowed(child, 'box');
    return new BoxBlock(
      boxNode.children.map((child) => createBlock(child)),
      {
        background: boxNode.background,
        borderColor: boxNode.borderColor,
        borderWidth: boxNode.borderWidth ?? DEFAULT_BOX_BORDER_WIDTH,
        padding: boxNode.padding ?? DEFAULT_BOX_PADDING,
        keepTogether: boxNode.keepTogether ?? false,
      },
    );
  });
}
