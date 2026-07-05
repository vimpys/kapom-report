import { normalizeText } from '../core/text-normalizer';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { ReportColumn } from '../types/column';
import type { GroupResolver } from '../types/node';
import type { SegmentState } from './column-resolver';
import { resolveAggregateRow, resolveSegmentBody } from './column-resolver';
import { groupFooterLabel, groupHeaderLabel, splitGroups } from './group-resolver';

/**
 * หนึ่ง node ใน group tree (roadmap 10 — nested group)
 * leaf (ไม่มี subGroup) มี `body` ไว้วาดเป็น AutoTable segment; non-leaf มี `children`
 * ไว้ recurse ต่อ — ทั้งสองแบบมี `foot` (subtotal) ของกลุ่มตัวเองถ้า column มี aggregate
 */
export interface GroupTreeNode<T> {
  label: string;
  /** 0 = ระดับนอกสุด — ใช้ indent band label ตามชั้น */
  depth: number;
  /** ทุก row ในกลุ่มนี้ (รวม sub-group) — ฐานของ subtotal ระดับนี้ */
  rows: readonly T[];
  /** keepTogether ของ resolver ระดับนี้ (default 1) */
  minRowsWithHeader: number;
  /** subtotal ของกลุ่มนี้ — undefined เมื่อไม่มี column ไหนประกาศ aggregate */
  foot: string[] | undefined;
  /** มีเมื่อ resolver ระดับนี้ประกาศ subGroup (non-leaf) */
  children: GroupTreeNode<T>[] | undefined;
  /** cell strings ของ segment — เฉพาะ leaf (non-leaf วาดผ่าน children แทน) */
  body: string[][] | undefined;
}

/**
 * แปลง GroupResolver chain (subGroup ซ้อนกัน N ระดับ) เป็น tree — pure, ไม่แตะ jsPDF
 * เดิน depth-first ตามลำดับ render จริง เพื่อให้ rowNumber/runningTotal 'continuous'
 * สะสมผ่าน state ข้าม leaf segment ถูกลำดับ (per-group reset ที่หัว segment เหมือนเดิม)
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

    if (resolver.subGroup) {
      return {
        label,
        depth,
        rows: group.rows,
        minRowsWithHeader: minRows,
        foot,
        children: buildGroupTree(columns, group.rows, resolver.subGroup, numeric, state, depth + 1),
        body: undefined,
      };
    }

    return {
      label,
      depth,
      rows: group.rows,
      minRowsWithHeader: minRows,
      foot,
      children: undefined,
      body: resolveSegmentBody(columns, group.rows, numeric, state),
    };
  });
}

/**
 * รวม cell rows ทั้ง tree ตามลำดับ render (body ของ leaf + foot ทุกระดับ) —
 * ใช้คำนวณ column widths ชุดเดียวข้ามทุก segment (เส้น column ตรงกันทั้งตาราง)
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

/** จำนวนกลุ่มทั้ง tree ทุกระดับรวมกัน (ใช้ estimate ความสูงใน measureHeight) */
export function countGroupBands<T>(resolver: GroupResolver<T>, data: readonly T[]): number {
  const groups = splitGroups(data, resolver);
  if (!resolver.subGroup) return groups.length;
  const sub = resolver.subGroup;
  return groups.reduce((total, group) => total + countGroupBands(sub, group.rows), groups.length);
}
