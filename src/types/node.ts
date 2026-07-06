import type { jsPDF } from 'jspdf';
import type { ReportColumn } from './column';
import type { CellStyle, RGB, TextStyle } from './primitives';
import type { Typography } from './typography';

/** the position + available width the engine hands a RawNode's draw callback */
export interface RawDrawCursor {
  x: number;
  y: number;
  contentWidth: number;
}

export interface TextNode {
  type: 'text';
  content: string;
  /** use a Typography token (e.g. 'reportTitle'/'reportSubtitle'/'sectionHeading') as the base style instead of DEFAULT_TEXT_STYLE — style overrides one property at a time */
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
  /** base64 (no data URI prefix) or binary */
  data: string | Uint8Array;
  format: 'PNG' | 'JPEG' | 'WEBP';
  width: number;
  height: number;
}

export interface SignatureSlot {
  /** label under the line, e.g. 'Prepared by' / 'Approved by' */
  label: string;
}

/** a signature line + label, multiple slots laid out horizontally in equal widths (Report Footer, roadmap 6d) */
export interface SignatureNode {
  type: 'signature';
  slots: readonly SignatureSlot[];
  /** blank space above the line, left for an actual signature (mm) — default DEFAULT_SIGNATURE_SIGN_HEIGHT */
  signHeight?: number;
  /** gap from the line to the label (mm) — default DEFAULT_SIGNATURE_LABEL_GAP */
  labelGap?: number;
  /** gap between slots (mm) — default DEFAULT_SIGNATURE_SLOT_GAP */
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
   * a group nested one level inside this one (recursive composition — roadmap 10), e.g. group by
   * region, then subGroup by category; nests to N levels, each level has its own band/subtotal/
   * keepTogether — a different concept from `TableNode.nested` (master-detail, which returns a
   * sub-table per row)
   */
  subGroup?: GroupResolver<T>;
}

/** alternating row colors — body section only (even/odd rowIndex) */
export interface ZebraOption {
  even?: RGB;
  odd?: RGB;
}

/**
 * zebra + conditional — precedence: conditional > zebra > row-type (Typography.detailRow)
 * conditional returning undefined = don't override that row (falls through to zebra/default)
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
  /** master-detail (2 levels, MVP); returns a sub-table per row */
  nested?: (row: T) => TableNode<unknown> | undefined;
  summaryLabel?: string;
  /** single-row message centered in the table when `data` is empty (No-Data fallback) — default DEFAULT_NO_DATA_TEXT */
  noDataText?: string;
  style?: TableStyleOptions<T>;
}

/**
 * escape hatch (level 2) — the user draws with jsPDF directly, while the engine still manages
 * the cursor/page-break: `measure(contentWidth)` reports the height up front so the engine can
 * decide whether to break before drawing, then `draw` gets the exact position + width to render at
 */
export interface RawNode {
  type: 'raw';
  measure: (contentWidth: number) => number;
  draw: (doc: jsPDF, cursor: RawDrawCursor) => void;
}

/** composite: renders children in order, measureHeight sums recursively — children accept text shorthand */
export interface StackNode<T> {
  type: 'stack';
  children: readonly ReportNodeInput<T>[];
}

/** like stack but carries a `name` for reference (e.g. Report Registry selects a section by name — roadmap 6c) */
export interface SectionNode<T> {
  type: 'section';
  name: string;
  children: readonly ReportNodeInput<T>[];
  /** always force a new page before this section (no-op if the cursor is already at the top of a page) — a page-break policy between sections (roadmap 6c) */
  breakBefore?: boolean;
}

/**
 * declarative tree — single source of truth
 * generic T binds the data type; children are recursive for composite/section
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

/** a TextNode without the need for `type` — used as input shorthand (`{ content: 'x', role?, style? }`) */
export type TextNodeShorthand = Omit<TextNode, 'type'>;

/**
 * the shape accepted everywhere a node is written (facade `blocks` / children of stack/section):
 * a plain string, or an object without `type`, is a text node — always normalized into a full
 * ReportNode by `resolveNodeInput()` before it reaches the registry (`type` on ReportNode stays
 * required because it's the union's discriminant — defaulting it at the type level isn't possible)
 */
export type ReportNodeInput<T = unknown> = ReportNode<T> | TextNodeShorthand | string;

/** convert shorthand into a full ReportNode — a string/object without `type` becomes a text node */
export function resolveNodeInput<T>(input: ReportNodeInput<T>): ReportNode<T> {
  if (typeof input === 'string') return { type: 'text', content: input };
  if (!('type' in input)) return { type: 'text', ...input };
  return input;
}
