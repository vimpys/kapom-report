import type { MeasurableBlock } from '../core/context';
import { KapomError } from '../core/errors';
import type { ReportNode, ReportNodeInput } from '../types/node';
import { resolveNodeInput } from '../types/node';

/**
 * `unknown` here is a real boundary — the registry holds factories for many different node
 * variants mixed together (TextNode, TableNode<Sale>, TableNode<Order>, ...); there's no single
 * type that fits all of them. Narrowing happens back at each built-in/plugin's own registration
 * site (see register-builtin-blocks.ts).
 */
export type BlockFactory = (node: ReportNode<unknown>) => MeasurableBlock;

const registry = new Map<string, BlockFactory>();

/**
 * Registers a new block type — core doesn't need to change to add a type (Open/Closed)
 * a duplicate name throws immediately, never a silent overwrite (prevents a plugin from
 * accidentally shadowing a built-in)
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
 * Converts a single node into a MeasurableBlock via the registered registry —
 * accepts text shorthand (a string / an object without `type`) and always normalizes it before dispatching
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
