import type { jsPDF } from 'jspdf';
import type { TableColumn } from './column';
import type { CellStyle, HAlign, RGB, TextStyle } from './primitives';
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
  /** horizontal alignment within the content width (applied per line after wrapping) — default 'left' */
  align?: HAlign;
}

export interface SpacerNode {
  type: 'spacer';
  /** gap height (mm); omit for the zero-config default (DEFAULT_SPACER_HEIGHT) */
  height?: number;
}

export interface DividerNode {
  type: 'divider';
  thickness?: number;
  color?: CellStyle['textColor'];
}

/** forces the flow onto a new page — a standalone counterpart to SectionNode.breakBefore; takes no space */
export interface PageBreakNode {
  type: 'pageBreak';
}

/**
 * default when a `nested` table doesn't set `nestedLayout` — 'stacked', because it's the only mode
 * that keeps the master header + identity with the detail when a long child breaks across pages
 * ('below' silently leaves the continuation with just the child's own header)
 */
export const DEFAULT_NESTED_LAYOUT = 'stacked' as const;

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

/** a signature line + label, multiple slots laid out horizontally in equal widths (a report footer) */
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

/**
 * How much of a group has to fit below its own header before the group may start on a page —
 * guards against an orphan header stranded at the bottom with its rows overleaf.
 */
export interface KeepTogetherPolicy {
  /** minimum body rows that must fit alongside the group header, or the whole group moves to the next page */
  minRowsWithHeader: number;
}

export interface GroupResolver<T> {
  by: keyof T | ((row: T) => string);
  headerLabel?: (groupKey: string, rows: readonly T[]) => string;
  footerLabel?: (groupKey: string, rows: readonly T[]) => string;
  sortGroups?: (a: string, b: string) => number;
  keepTogether?: KeepTogetherPolicy;
  /**
   * a group nested one level inside this one (recursive composition), e.g. group by
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
  /**
   * head-section style override merged over the Typography.columnHeader token (e.g. a brand
   * fillColor instead of AutoTable's default) — head only, no interplay with zebra/conditional
   * (those are body-only by design); per-column headerAlign still wins over `halign` here
   */
  header?: Partial<CellStyle>;
  /**
   * foot-section (summary / subtotal row) style override merged over the Typography.summary /
   * groupFooter token — the symmetric counterpart of `header` (e.g. a brand fillColor on the
   * total row). Applies to each AutoTable segment's foot; the grouped grand-total / non-leaf
   * subtotal rows keep their fixed identity fills.
   */
  footer?: Partial<CellStyle>;
}

export interface TableNode<T> {
  type: 'table';
  /** top-level columns — leaf columns and/or `ColumnGroup`s; the `type: 'data'` shorthand may be omitted anywhere (a group renders a spanning super-header) */
  columns: readonly TableColumn<T>[];
  data: readonly T[];
  group?: GroupResolver<T>;
  /**
   * master-detail (2 levels, MVP); returns a sub-table per row (`undefined` = this row has no
   * detail). The child's row type is necessarily `unknown` here (rows across a whole table can't
   * share a single concrete type when each row's child table has its own independent columns) —
   * a concrete `TableNode<Payment>` literal needs `satisfies TableNode<Payment> as unknown as
   * TableNode<unknown>` to assign here (an invariance quirk of `DataColumn.key: keyof T`, same
   * reason `ReportRegistry` casts once internally)
   */
  nested?: (row: T) => TableNode<unknown> | undefined;
  /**
   * how a `nested` child is laid out — default `DEFAULT_NESTED_LAYOUT` (`'stacked'`):
   * - `'stacked'` — each master row with a child becomes one self-contained block: the master
   *   column header + that row's values (an identity band) + the child header + the child rows,
   *   all in a single table so **all of it repeats on a page break** (the reader always knows
   *   which master row the detail belongs to). The trade-off: the master identity sits *above*
   *   the detail, not beside it. `nestedIndentColumn` is ignored in this mode.
   * - `'below'` — the child table renders indented right under its master row (see
   *   `nestedIndentColumn`); on a page break **only the child's own header repeats**, so detail
   *   continuing on a later page loses the master header/identity above it — opt into this only
   *   when the child is short enough not to break, or that context loss is acceptable
   */
  nestedLayout?: 'below' | 'stacked';
  /**
   * 0-based column index the nested child table's left edge aligns to (default 0 = full width,
   * no indent) — computed from this table's own resolved column widths, so the child's left edge
   * always lines up exactly with that column's grid line, like a colSpan across the rest.
   * Only applies to `nestedLayout: 'below'`.
   */
  nestedIndentColumn?: number;
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

/** one column of a RowNode — a vertical stack of blocks constrained to the column's width */
export interface RowColumn<T> {
  /** fixed width (mm); omit = share the remaining width equally with the other flexible columns */
  width?: number;
  children: readonly ReportNodeInput<T>[];
}

/**
 * horizontal composite: columns laid side by side, each one a vertical stack of ordinary blocks;
 * the row's height = its tallest column. The whole row is kept together (ensureSpace for the full
 * height, never breaks inside) — meant for headers/info sections, not page-length content.
 * v1 scope: children that paginate themselves or force page-breaks (table/section) are rejected
 * fail-fast at build time.
 */
export interface RowNode<T> {
  type: 'row';
  columns: readonly RowColumn<T>[];
  /** horizontal gap between columns (mm) — default DEFAULT_ROW_GAP */
  gap?: number;
}

/**
 * label + value pairs as aligned rows (quotation meta, totals, document properties) — the label
 * column is bold by default; labelWidth omitted = widest label measured from the actual font.
 * Labels/values are single-line by design (no wrapping) — for wrapped content compose a RowNode
 * of text blocks instead.
 */
export interface KeyValueNode {
  type: 'keyValue';
  rows: ReadonlyArray<readonly [label: string, value: string]>;
  /** label column width (mm) — default: widest label + a small gap, measured from the actual font */
  labelWidth?: number;
  /** merged over { ...DEFAULT_TEXT_STYLE, fontStyle: 'bold' } */
  labelStyle?: Partial<TextStyle>;
  /** merged over DEFAULT_TEXT_STYLE */
  valueStyle?: Partial<TextStyle>;
  /** value alignment within the remaining width — default 'left' (next to the label column) */
  valueAlign?: HAlign;
}

/**
 * a painted container: fill/border/padding around a vertical stack of blocks. By default it
 * splits across pages at child boundaries, "clone" style — each page's segment closes its own
 * background/border + padding, then a fresh box continues at the top of the next page (a single
 * text node never splits internally — it moves to the next segment whole, so a one-child box
 * effectively keeps together automatically). Children that paginate themselves or force
 * page-breaks (table/section) are rejected fail-fast at build time, same as RowNode.
 */
export interface BoxNode<T> {
  type: 'box';
  children: readonly ReportNodeInput<T>[];
  /** fill color behind the content — unset = no fill (a transparent padded group) */
  background?: RGB;
  /** border stroke color — unset = no border */
  borderColor?: RGB;
  /** border stroke width (mm) — default DEFAULT_BOX_BORDER_WIDTH; only used when borderColor is set */
  borderWidth?: number;
  /** uniform inner padding (mm) — default DEFAULT_BOX_PADDING */
  padding?: number;
  /**
   * corner radius (mm) for the fill/border — default 0 (square corners). A box that splits across
   * pages rounds every segment's own corners (so a mid-break segment is rounded on all sides).
   */
  radius?: number;
  /**
   * never split: not enough room = the whole box moves to the next page, and content taller
   * than one full page throws KapomLayoutError — default false (split between children)
   */
  keepTogether?: boolean;
}

/**
 * pins its children to the bottom of the current page: advances the cursor to fill the gap
 * first (contentBottom − cursor.y − children height), then renders the children — a report
 * footer / signature that should sit at the page bottom rather than flowing right after the
 * body. Use as the last block (content after it starts at the page bottom); if the body already
 * reaches near the bottom there's no gap to fill and the children render right after it.
 */
export interface BottomAnchorNode<T> {
  type: 'bottomAnchor';
  children: readonly ReportNodeInput<T>[];
}

/** composite: renders children in order, measureHeight sums recursively — children accept text shorthand */
export interface StackNode<T> {
  type: 'stack';
  children: readonly ReportNodeInput<T>[];
}

/** like stack but carries a `name` for reference (e.g. Report Registry selects a section by name) */
export interface SectionNode<T> {
  type: 'section';
  name: string;
  children: readonly ReportNodeInput<T>[];
  /** always force a new page before this section (no-op if the cursor is already at the top of a page) — a page-break policy between sections */
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
  | PageBreakNode
  | ImageNode
  | SignatureNode
  | TableNode<T>
  | RawNode
  | StackNode<T>
  | SectionNode<T>
  | RowNode<T>
  | KeyValueNode
  | BoxNode<T>
  | BottomAnchorNode<T>;

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

/** shorthand constructor for a vertical gap — `spacer(4)` instead of `{ type: 'spacer', height: 4 }`, or `spacer()` for the zero-config default gap (used a lot, so worth the tiny helper) */
export const spacer = (height?: number): SpacerNode =>
  height === undefined ? { type: 'spacer' } : { type: 'spacer', height };

/** shorthand constructor for a horizontal rule — `divider()` (zero-config) or `divider({ thickness, color })` instead of the full node */
export const divider = (options: Omit<DividerNode, 'type'> = {}): DividerNode => ({ type: 'divider', ...options });

/** shorthand constructor for a forced page break — `pageBreak()` instead of `{ type: 'pageBreak' }` */
export const pageBreak = (): PageBreakNode => ({ type: 'pageBreak' });
