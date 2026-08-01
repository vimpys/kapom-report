import type { GroupResolver } from '../types/node';

export interface ResolvedGroup<T> {
  key: string;
  rows: T[];
}

/**
 * the label for a group whose key is null/undefined/empty — prevents a band
 * from literally showing "null"/"undefined" (real DB data can always have NULL mixed into a
 * group column); overridable via headerLabel/footerLabel, which receive this key to transform
 * further — English (2026-07-07 — was Thai '(ไม่ระบุ)') for the same zero-config reason as
 * DEFAULT_SUMMARY_LABEL: a group with no font registered shouldn't hit the Thai font guard
 * just from an unspecified key
 */
export const UNSPECIFIED_GROUP_KEY = '(unspecified)';

/**
 * Splits a flat array into groups by GroupResolver.by — preserves order by each key's first
 * appearance (data already sorted by the DB keeps that group order); sortGroups can override this.
 */
export function splitGroups<T>(
  data: readonly T[],
  resolver: GroupResolver<T>,
): ResolvedGroup<T>[] {
  const by = resolver.by;
  const keyOf =
    typeof by === 'function'
      ? by
      : (row: T): string => {
          const value = row[by];
          if (value === null || value === undefined) return UNSPECIFIED_GROUP_KEY;
          const key = String(value);
          return key === '' ? UNSPECIFIED_GROUP_KEY : key;
        };

  const buckets = new Map<string, T[]>();
  for (const row of data) {
    const key = keyOf(row);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  const groups = [...buckets.entries()].map(([key, rows]) => ({ key, rows }));
  const sorter = resolver.sortGroups;
  if (sorter) groups.sort((a, b) => sorter(a.key, b.key));
  return groups;
}

export function groupHeaderLabel<T>(
  resolver: GroupResolver<T>,
  key: string,
  rows: readonly T[],
): string {
  return resolver.headerLabel?.(key, rows) ?? key;
}

/** the default matches DEFAULT_SUMMARY_LABEL (English, zero-config) — a subtotal names its group to avoid confusion with the grand total */
export function groupFooterLabel<T>(
  resolver: GroupResolver<T>,
  key: string,
  rows: readonly T[],
): string {
  return resolver.footerLabel?.(key, rows) ?? `Total ${key}`;
}
