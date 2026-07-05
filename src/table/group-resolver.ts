import type { GroupResolver } from '../types/node';

export interface ResolvedGroup<T> {
  key: string;
  rows: T[];
}

/**
 * แบ่ง flat array เป็นกลุ่มตาม GroupResolver.by — คงลำดับตามที่ key ปรากฏครั้งแรก
 * (ข้อมูลที่ sort มาแล้วจาก DB จะได้ลำดับกลุ่มตามนั้น); sortGroups override ได้
 */
export function splitGroups<T>(
  data: readonly T[],
  resolver: GroupResolver<T>,
): ResolvedGroup<T>[] {
  const by = resolver.by;
  const keyOf =
    typeof by === 'function' ? by : (row: T): string => String(row[by]);

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

/** default สอดคล้อง DEFAULT_SUMMARY_LABEL — subtotal ระบุชื่อกลุ่มกันสับสนกับ grand total */
export function groupFooterLabel<T>(
  resolver: GroupResolver<T>,
  key: string,
  rows: readonly T[],
): string {
  return resolver.footerLabel?.(key, rows) ?? `รวม ${key}`;
}
