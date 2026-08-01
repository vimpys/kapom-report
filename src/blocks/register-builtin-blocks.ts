import { createBlock, hasBlockType, registerBlockType } from './block-registry';
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
import { BottomAnchorBlock } from './bottom-anchor-block';
import { PageBreakBlock } from './page-break-block';
import type {
  BottomAnchorNode,
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

/**
 * Built-in blocks register through the same registry API a plugin would use (no special
 * privilege). This is a named function, not a side-effect import — a bundler that sees
 * `sideEffects: false` can silently drop a bare import (seen for real when bundling for the
 * browser: esbuild warns "Ignoring this import" → createBlock then throws "unknown type" for
 * every type at runtime). Calling the function directly from create-block.ts is a side effect
 * inside a module whose exports are actually used, which a bundler can't drop.
 *
 * Idempotent, and the guard has to read the shared registry rather than a module-scoped flag:
 * the CJS build embeds a copy of this module in each entry point, so a local flag starts out
 * false in the second copy and every registerBlockType call would throw on the duplicate name
 * (see the globalThis note in block-registry.ts). 'text' stands in for the whole set — the
 * registrations below are one atomic, synchronous block that always runs together.
 */
export function registerBuiltinBlocks(): void {
  if (hasBlockType('text')) return;

  registerBlockType('text', (node) => new TextBlock(node as TextNode));
  registerBlockType('spacer', (node) => new SpacerBlock(node as SpacerNode));
  registerBlockType('divider', (node) => new DividerBlock(node as DividerNode));
  registerBlockType('pageBreak', () => new PageBreakBlock());
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
  registerBlockType('bottomAnchor', (node) => {
    const anchorNode = node as BottomAnchorNode<unknown>;

    return new BottomAnchorBlock(anchorNode.children.map((child) => createBlock(child)));
  });
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
        radius: boxNode.radius ?? 0,
        keepTogether: boxNode.keepTogether ?? false,
      },
    );
  });
}
