import type { Decimalish } from '../numeric/numeric-strategy';
import type { ReportColumn } from './column';
import type { CellStyle, TextStyle } from './primitives';

export interface TextNode {
  type: 'text';
  content: string;
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

export interface GroupResolver<T> {
  by: keyof T | ((row: T) => string);
  headerLabel?: (groupKey: string, rows: readonly T[]) => string;
  footerLabel?: (groupKey: string, rows: readonly T[]) => string;
  sortGroups?: (a: string, b: string) => number;
  keepTogether?: { minRowsWithHeader: number };
}

export interface TableNode<T> {
  type: 'table';
  columns: readonly ReportColumn<T>[];
  data: readonly T[];
  group?: GroupResolver<T>;
  /** master-detail (2 ระดับ MVP); คืน sub-table ต่อ row */
  nested?: (row: T) => TableNode<unknown> | undefined;
  summaryLabel?: string;
}

export interface RawNode {
  type: 'raw';
  measure: (contentWidth: number) => number;
  /** escape hatch: วาด jsPDF เอง ใน scope ที่ engine คุม cursor ให้ */
  draw: (doc: unknown, cursor: { x: number; y: number }) => void;
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
  | TableNode<T>
  | RawNode
  | { type: 'stack'; children: readonly ReportNode<T>[] }
  | { type: 'section'; name: string; children: readonly ReportNode<T>[] };

export interface SummaryValue {
  columnKey: string;
  value: Decimalish;
}
