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

/**
 * The registry is keyed off globalThis rather than held in module scope, because this module is
 * evaluated more than once in a real install:
 * - the package ships two entry points (`kapom-report` + `kapom-report/advanced`) and the CJS
 *   build has no code splitting, so each entry embeds its own copy of this file. With a
 *   module-scoped Map, `registerBlockType` (exported from /advanced) wrote into a different
 *   registry than the one `createBlock` (reached via the main entry) read from, and every
 *   plugin block threw "is not registered" for CJS consumers.
 * - the same applies to a consumer who ends up with two copies of the package installed
 *   (transitive version conflict) or who mixes the ESM and CJS builds in one process.
 *
 * The key is versioned: a future breaking change to BlockFactory must bump it, so two major
 * versions sharing a process each get their own registry instead of handing each other
 * incompatible factories.
 */
const REGISTRY_KEY = Symbol.for('kapom-report.block-registry.v1');

type RegistryHost = typeof globalThis & { [REGISTRY_KEY]?: Map<string, BlockFactory> };

function registry(): Map<string, BlockFactory> {
  const host = globalThis as RegistryHost;
  const existing = host[REGISTRY_KEY];
  if (existing) return existing;
  const created = new Map<string, BlockFactory>();
  host[REGISTRY_KEY] = created;
  return created;
}

/**
 * Whether a block type is already registered — lets a plugin author check before registering
 * instead of catching the duplicate-name throw, and lets registerBuiltinBlocks stay idempotent
 * across the duplicated module copies described above (a module-scoped "done" flag can't).
 */
export function hasBlockType(type: string): boolean {
  return registry().has(type);
}

/**
 * Registers a new block type — core doesn't need to change to add a type (Open/Closed)
 * a duplicate name throws immediately, never a silent overwrite (prevents a plugin from
 * accidentally shadowing a built-in)
 */
export function registerBlockType(type: string, factory: BlockFactory): void {
  const blocks = registry();
  if (blocks.has(type)) {
    throw new KapomError(
      `Block type '${type}' is already registered — check for duplicate registration or a name clash with a built-in`,
    );
  }

  blocks.set(type, factory);
}

/**
 * Converts a single node into a MeasurableBlock via the registered registry —
 * accepts text shorthand (a string / an object without `type`) and always normalizes it before dispatching
 */
export function createBlock<T>(input: ReportNodeInput<T>): MeasurableBlock {
  const node = resolveNodeInput(input);
  const blocks = registry();
  const factory = blocks.get(node.type);
  if (!factory) {
    // listing what IS registered turns the usual cause (a typo in `type`) into a one-glance fix
    throw new KapomError(
      `Block type '${node.type}' is not registered. Register a custom type with registerBlockType() ` +
        `from 'kapom-report/advanced' before rendering it. Available: ${[...blocks.keys()].join(', ')}`,
    );
  }

  return factory(node as ReportNode<unknown>);
}
