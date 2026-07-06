import type { ReportColumn } from './column';
import type { CellStyle, RGB, TextStyle } from './primitives';
import type { Typography } from './typography';

export interface TextNode {
  type: 'text';
  content: string;
  /** ใช้ Typography token (เช่น 'reportTitle'/'reportSubtitle'/'sectionHeading') เป็น base style แทน DEFAULT_TEXT_STYLE — style ทับได้ทีละ property */
  role?: keyof Typography;
  style?: Partial<TextStyle>;
}

export interface SpacerNode {
  type: 'spacer';
  height: number;
}

export interface DividerNode {
  type: 'divider';
  thickness?: number;
  color?: CellStyle['textColor'];
}

export interface ImageNode {
  type: 'image';
  /** base64 (ไม่มี data URI prefix) หรือ binary */
  data: string | Uint8Array;
  format: 'PNG' | 'JPEG' | 'WEBP';
  width: number;
  height: number;
}

export interface SignatureSlot {
  /** label ใต้เส้น เช่น 'ผู้จัดทำ' / 'ผู้อนุมัติ' */
  label: string;
}

/** เส้นเซ็นชื่อ + label หลาย slot เรียงแนวนอนแบ่งพื้นที่เท่ากัน (Report Footer, roadmap 6d) */
export interface SignatureNode {
  type: 'signature';
  slots: readonly SignatureSlot[];
  /** พื้นที่ว่างเหนือเส้นไว้เซ็นจริง (mm) — default DEFAULT_SIGNATURE_SIGN_HEIGHT */
  signHeight?: number;
  /** ระยะห่างจากเส้นถึง label (mm) — default DEFAULT_SIGNATURE_LABEL_GAP */
  labelGap?: number;
  /** ช่องว่างระหว่าง slot (mm) — default DEFAULT_SIGNATURE_SLOT_GAP */
  slotGap?: number;
  style?: Partial<TextStyle>;
}

export interface GroupResolver<T> {
  by: keyof T | ((row: T) => string);
  headerLabel?: (groupKey: string, rows: readonly T[]) => string;
  footerLabel?: (groupKey: string, rows: readonly T[]) => string;
  sortGroups?: (a: string, b: string) => number;
  keepTogether?: { minRowsWithHeader: number };
  /**
   * group ซ้อนข้างในกลุ่มนี้อีกชั้น (recursive composition — roadmap 10) เช่น group by region
   * แล้ว subGroup by category; ซ้อนได้ N ระดับ, แต่ละระดับมี band/subtotal/keepTogether ของตัวเอง
   * — คนละเรื่องกับ `TableNode.nested` (master-detail ที่คืน sub-table ต่อ row)
   */
  subGroup?: GroupResolver<T>;
}

/** สีแถวสลับ — ใช้กับ body section เท่านั้น (rowIndex คู่/คี่) */
export interface ZebraOption {
  even?: RGB;
  odd?: RGB;
}

/**
 * zebra + conditional — precedence: conditional > zebra > row-type (Typography.detailRow)
 * conditional คืน undefined = ไม่ override แถวนั้น (fall through ไป zebra/default)
 */
export interface TableStyleOptions<T> {
  zebra?: ZebraOption;
  conditional?: (row: T, rowIndex: number) => Partial<CellStyle> | undefined;
}

export interface TableNode<T> {
  type: 'table';
  columns: readonly ReportColumn<T>[];
  data: readonly T[];
  group?: GroupResolver<T>;
  /** master-detail (2 ระดับ MVP); คืน sub-table ต่อ row */
  nested?: (row: T) => TableNode<unknown> | undefined;
  summaryLabel?: string;
  /** ข้อความแถวเดียวกลางตารางเมื่อ `data` ว่าง (No-Data fallback) — default 'ไม่มีข้อมูล' */
  noDataText?: string;
  style?: TableStyleOptions<T>;
}

export interface RawNode {
  type: 'raw';
  measure: (contentWidth: number) => number;
  /** escape hatch: วาด jsPDF เอง ใน scope ที่ engine คุม cursor ให้ */
  draw: (doc: unknown, cursor: { x: number; y: number }) => void;
}

/** composite: render children ตามลำดับ, measureHeight รวมแบบ recursive — children รับ text shorthand ได้ */
export interface StackNode<T> {
  type: 'stack';
  children: readonly ReportNodeInput<T>[];
}

/** เหมือน stack แต่มี `name` ไว้อ้างอิง (เช่น Report Registry เลือก section ด้วยชื่อ — roadmap 6c) */
export interface SectionNode<T> {
  type: 'section';
  name: string;
  children: readonly ReportNodeInput<T>[];
  /** บังคับขึ้นหน้าใหม่ก่อน section นี้เสมอ (no-op ถ้า cursor อยู่หัวหน้าอยู่แล้ว) — page-break policy ระหว่าง section (roadmap 6c) */
  breakBefore?: boolean;
}

/**
 * declarative tree — single source of truth
 * generic T ผูก data type; children เป็น recursive สำหรับ composite/section
 */
export type ReportNode<T = unknown> =
  | TextNode
  | SpacerNode
  | DividerNode
  | ImageNode
  | SignatureNode
  | TableNode<T>
  | RawNode
  | StackNode<T>
  | SectionNode<T>;

/** TextNode ที่ไม่ต้องใส่ `type` — ใช้เป็น input shorthand (`{ content: 'x', role?, style? }`) */
export type TextNodeShorthand = Omit<TextNode, 'type'>;

/**
 * รูปแบบที่ยอมรับทุกจุดที่เขียน node (facade `blocks` / children ของ stack/section):
 * string ตรงๆ หรือ object ไม่ใส่ `type` = text node — normalize เป็น ReportNode เต็มรูป
 * ที่ `resolveNodeInput()` ก่อนเข้า registry เสมอ (`type` ใน ReportNode ยังเป็น required
 * เพราะเป็น discriminant ของ union — default ที่ type level ตรงๆ ทำไม่ได้)
 */
export type ReportNodeInput<T = unknown> = ReportNode<T> | TextNodeShorthand | string;

/** แปลง shorthand เป็น ReportNode เต็มรูป — string/object ไม่มี `type` → text node */
export function resolveNodeInput<T>(input: ReportNodeInput<T>): ReportNode<T> {
  if (typeof input === 'string') return { type: 'text', content: input };
  if (!('type' in input)) return { type: 'text', ...input };
  return input;
}

