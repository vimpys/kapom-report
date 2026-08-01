import { normalizeText } from '../core/text-normalizer';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { ReportColumn } from '../types/column';
import type { GroupResolver } from '../types/node';
import type { SegmentState } from './column-resolver';
import { resolveAggregateRow, resolveSegmentBody } from './column-resolver';
import { groupFooterLabel, groupHeaderLabel, splitGroups } from './group-resolver';

/**
 * A single node in the group tree (nested group)
 * A leaf (no subGroup) has a `body` to draw as an AutoTable segment; a non-leaf has `children`
 * to recurse into — both kinds have their own `foot` (subtotal) if a column has an aggregate.
 */
export interface GroupTreeNode<T> {
  label: string;
  /** 0 = the outermost level — used to indent the band label per level */
  depth: number;
  /** every row in this group (including sub-groups) — the basis for this level's subtotal */
  rows: readonly T[];
  /** this level's resolver's keepTogether (default 1) */
  minRowsWithHeader: number;
  /** this group's subtotal — undefined when no column declares an aggregate */
  foot: string[] | undefined;
  /** present when this level's resolver declares a subGroup (non-leaf) */
  children: GroupTreeNode<T>[] | undefined;
  /** the segment's cell strings — leaf only (a non-leaf draws through children instead) */
  body: string[][] | undefined;
}

/**
 * Converts a GroupResolver chain (subGroup nested N levels deep) into a tree — pure, doesn't touch jsPDF
 * walks depth-first in the actual render order, so 'continuous' rowNumber/runningTotal
 * accumulate through state across leaf segments in the right order (per-group reset at the start of a segment, same as before)
 */
export function buildGroupTree<T>(
  columns: readonly ReportColumn<T>[],
  data: readonly T[],
  resolver: GroupResolver<T>,
  numeric: NumericStrategy,
  state: SegmentState,
  depth = 0,
): GroupTreeNode<T>[] {
  const groups = splitGroups(data, resolver);
  const minRows = resolver.keepTogether?.minRowsWithHeader ?? 1;

  return groups.map((group) => {
    const label = normalizeText(groupHeaderLabel(resolver, group.key, group.rows));
    const foot = resolveAggregateRow(
      columns,
      group.rows,
      numeric,
      groupFooterLabel(resolver, group.key, group.rows),
    );

    const base = { label, depth, rows: group.rows, minRowsWithHeader: minRows, foot };

    return resolver.subGroup
      ? {
          ...base,
          children: buildGroupTree(columns, group.rows, resolver.subGroup, numeric, state, depth + 1),
          body: undefined,
        }
      : {
          ...base,
          children: undefined,
          body: resolveSegmentBody(columns, group.rows, numeric, state),
        };
  });
}

/**
 * Flattens every cell row across the whole tree in render order (each leaf's body + every
 * level's foot) — used to compute a single set of column widths across every segment (keeps column lines aligned across the whole table)
 */
export function flattenGroupTreeRows<T>(tree: readonly GroupTreeNode<T>[]): string[][] {
  const rows: string[][] = [];
  for (const node of tree) {
    if (node.children) {
      rows.push(...flattenGroupTreeRows(node.children));
    } else if (node.body) {
      rows.push(...node.body);
    }

    if (node.foot) rows.push(node.foot);
  }

  return rows;
}

/** total group count across every level of the tree (used to estimate height in measureHeight) */
export function countGroupBands<T>(resolver: GroupResolver<T>, data: readonly T[]): number {
  const groups = splitGroups(data, resolver);
  if (!resolver.subGroup) return groups.length;
  const sub = resolver.subGroup;

  return groups.reduce((total, group) => total + countGroupBands(sub, group.rows), groups.length);
}
