export type {
  Decimalish,
  NumericStrategy,
} from './numeric/numeric-strategy';
export { nativeNumeric } from './numeric/numeric-strategy';

export type {
  HAlign,
  FontStyle,
  RGB,
  DeepPartial,
  TextStyle,
  NumberFormat,
  CellStyle,
} from './types/primitives';

export type {
  AggregateFn,
  RowNumberMode,
  DataColumn,
  RowNumberColumn,
  ComputedColumn,
  RunningTotalColumn,
  ReportColumn,
  ResolvedAlign,
} from './types/column';
export {
  isDataColumn,
  isDerivedColumn,
  resolveColumnAlign,
  isColumnVisible,
} from './types/column';

export type {
  TextNode,
  SpacerNode,
  DividerNode,
  ImageNode,
  GroupResolver,
  ZebraOption,
  TableStyleOptions,
  TableNode,
  RawNode,
  ReportNode,
  SummaryValue,
} from './types/node';

export type { Typography } from './types/typography';
export { DEFAULT_TYPOGRAPHY, resolveTypography } from './types/typography';

export type {
  PageMargins,
  CursorState,
  MeasureContext,
  RenderContext,
  MeasurableBlock,
} from './core/context';

export { KapomError, KapomLayoutError, KapomFontError } from './core/errors';

export type { PdfCursorOptions } from './core/cursor';
export { PdfCursor } from './core/cursor';

export type { RenderEngineOptions } from './core/engine';
export { RenderEngine, DEFAULT_PAGE_MARGINS } from './core/engine';

export type { PageBand, PageBandContext, PageBandRenderer } from './core/page-band';

export type { TextNormalizeOptions } from './core/text-normalizer';
export { normalizeText } from './core/text-normalizer';
export { drawText } from './core/draw-text';

export type { FontConfig, FontSource, FontVariantStyle } from './font/font-config';
export { registerFonts } from './font/register-fonts';

export { DEFAULT_TEXT_STYLE, TextBlock } from './blocks/text-block';
export { SpacerBlock } from './blocks/spacer-block';
export {
  DEFAULT_DIVIDER_THICKNESS,
  DEFAULT_DIVIDER_COLOR,
  DividerBlock,
} from './blocks/divider-block';
export { ImageBlock } from './blocks/image-block';
export { TableBlock } from './blocks/table-block';
export { createBlock } from './blocks/create-block';

export type { BlockFactory } from './blocks/block-registry';
export { registerBlockType } from './blocks/block-registry';

export { DEFAULT_NUMBER_FORMAT, formatNumber, getNumberFormatter } from './format/number-format';

export type { ResolvedTableContent, SegmentState } from './table/column-resolver';
export {
  resolveTableContent,
  resolveSegmentBody,
  resolveAggregateRow,
  createSegmentState,
  visibleColumns,
  DEFAULT_SUMMARY_LABEL,
} from './table/column-resolver';
export { computeAggregate, asDecimalish } from './table/aggregate';
export type { ResolvedGroup } from './table/group-resolver';
export { splitGroups, groupHeaderLabel, groupFooterLabel } from './table/group-resolver';
export { computeColumnWidths } from './table/column-width';

export { resolveRowStyle } from './style/resolve-cell-style';
