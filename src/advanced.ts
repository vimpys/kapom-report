// side-effect import — same reason as in index.ts: pull the `jsPDF.lastAutoTable` module
// augmentation into this entry's .d.ts bundle (RenderEngine/TableBlock read it internally), so a
// consumer importing from 'kapom-report/advanced' still gets the augmented jsPDF type
import './types/jspdf-autotable';

/**
 * Advanced / low-level API — `import { ... } from 'kapom-report/advanced'`.
 *
 * These are the building blocks the public facade sits on: the render engine + cursor, the block
 * classes, the pure table pipeline (group tree / aggregate / column widths), the config resolvers,
 * and plugin authoring (`registerBlockType` + `MeasurableBlock`/`RenderContext` for custom blocks).
 * They're supported, but they're the internal seams of the library and change more freely than the
 * public surface — reach here only when the facade can't express what you need.
 */

// ── render engine + cursor (the core render loop) ──────────────────────────
export type { RenderEngineOptions } from './core/engine';
export { RenderEngine, DEFAULT_PAGE_MARGINS } from './core/engine';
export type { PdfCursorOptions } from './core/cursor';
export { PdfCursor } from './core/cursor';

// ── block contract + context (for authoring custom blocks) ─────────────────
export type { CursorState, MeasureContext, RenderContext, MeasurableBlock } from './core/context';

// ── plugin authoring: register a new block type ────────────────────────────
export type { BlockFactory } from './blocks/block-registry';
export { registerBlockType } from './blocks/block-registry';
export { createBlock } from './blocks/create-block';

// ── built-in block classes (the declarative node tree is the normal path) ──
export { DEFAULT_TEXT_STYLE, TextBlock } from './blocks/text-block';
export { DEFAULT_SPACER_HEIGHT, SpacerBlock } from './blocks/spacer-block';
export { PageBreakBlock } from './blocks/page-break-block';
export { DEFAULT_DIVIDER_THICKNESS, DEFAULT_DIVIDER_COLOR, DividerBlock } from './blocks/divider-block';
export { ImageBlock } from './blocks/image-block';
export {
  DEFAULT_SIGNATURE_SIGN_HEIGHT,
  DEFAULT_SIGNATURE_LABEL_GAP,
  DEFAULT_SIGNATURE_SLOT_GAP,
  SignatureBlock,
} from './blocks/signature-block';
export { TableBlock } from './blocks/table-block';
export { StackBlock } from './blocks/stack-block';
export { SectionBlock } from './blocks/section-block';
export { RawBlock } from './blocks/raw-block';

// ── config resolvers (Progressive Disclosure → ReportNode tree; pure) ──────
export type { ResolvedReportConfig } from './report/resolve-report-config';
export { resolveReportConfig, resolveTableNode } from './report/resolve-report-config';
export { resolveNodeInput } from './types/node';

// ── resolved forms + resolvers of the page-frame / theme / typography ──────
export type { BlockBand, PageBandLike } from './core/page-band';
export type { ResolvedTheme } from './theme/theme';
export { DEFAULT_RESOLVED_THEME, resolveTheme } from './theme/theme';
export { resolveTypography } from './types/typography';
export { resolveWatermark } from './core/watermark';
export { resolvePageNumber, renderPageNumber } from './core/page-number';

// ── column introspection helpers ────────────────────────────────────────────
export {
  resolveColumnAlign,
  isColumnVisible,
  isColumnGroup,
  flattenColumns,
  columnDepth,
} from './types/column';

// ── pure table pipeline (no jsPDF) ──────────────────────────────────────────
export type { ResolvedTableContent, SegmentState } from './table/column-resolver';
export {
  resolveTableContent,
  resolveSegmentBody,
  resolveAggregateRow,
  firstAggregateLabelIndex,
  createSegmentState,
  visibleColumns,
  DEFAULT_SUMMARY_LABEL,
  DEFAULT_NO_DATA_TEXT,
} from './table/column-resolver';
export { computeAggregate, asDecimalish } from './table/aggregate';
export type { ResolvedGroup } from './table/group-resolver';
export {
  splitGroups,
  groupHeaderLabel,
  groupFooterLabel,
  UNSPECIFIED_GROUP_KEY,
} from './table/group-resolver';
export type { GroupTreeNode } from './table/group-tree';
export { buildGroupTree, flattenGroupTreeRows, countGroupBands } from './table/group-tree';
export { computeColumnWidths } from './table/column-width';
export { resolveRowStyle } from './style/resolve-cell-style';

// ── formatting internals ────────────────────────────────────────────────────
export { getNumberFormatter } from './format/number-format';

// ── font-guard internals ─────────────────────────────────────────────────────
export { containsThai, isBuiltinStandardFont } from './core/font-guard';
