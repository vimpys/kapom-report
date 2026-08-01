import { KapomError } from '../core/errors';
import type { SectionNode } from '../types/node';

/** builds a SectionNode from shared context (e.g. hotel name/date) — called only at build() time */
export type SectionBuilder<C> = (context: C) => SectionNode<unknown>;

/**
 * Composes a Composite Report from multiple sections, selected by name — one
 * instance per report (unlike block-registry, which is a global singleton for block *types*:
 * a section is content specific to one report, not an extensibility point of the lib, so it
 * shouldn't share state across reports). Shared context (e.g. hotel name/date) is injected once
 * at build() time, so every section builder sees the same values; the result is a SectionNode[]
 * matching a regular ReportNode tree — the caller passes it through createBlock and into
 * RenderEngine.render() like any other node.
 */
export class ReportRegistry<C> {
  private readonly builders = new Map<string, SectionBuilder<C>>();

  /**
   * Registers a section by name — a duplicate name throws immediately, preventing builders
   * from silently overwriting each other. The generic T here lets each builder return a
   * concrete `SectionNode<Sale>`/`SectionNode<Expense>` directly (no need to annotate
   * `SectionNode<unknown>` yourself) — `TableNode<T>`'s invariance in T (e.g. `key: keyof T`
   * becomes `never` if T is `unknown` directly) is contained as a single `unknown` boundary
   * internally, the same pattern as `BlockFactory` in block-registry.ts.
   */
  register<T>(name: string, builder: (context: C) => SectionNode<T>): void {
    if (this.builders.has(name)) {
      throw new KapomError(`ReportRegistry: section '${name}' is already registered`);
    }
    this.builders.set(name, builder as unknown as SectionBuilder<C>);
  }

  /** composes sections in the given name order — a name that was never registered throws immediately (fail-fast, never a silent skip) */
  build(order: readonly string[], context: C): SectionNode<unknown>[] {
    return order.map((name) => {
      const builder = this.builders.get(name);
      if (!builder) {
        throw new KapomError(`ReportRegistry: section '${name}' is not registered`);
      }
      return builder(context);
    });
  }
}
