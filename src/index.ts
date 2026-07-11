// side-effect import — pulls the `jsPDF.lastAutoTable` module augmentation into the published
// .d.ts bundle; tsup's dts bundler only follows the import graph from this entry point, so
// without this the ambient declaration (picked up locally only via tsconfig `include`) never
// ships to consumers (see CLAUDE.md "jsPDF 4.x หมายเหตุ") — the augmentation file must be a
// plain `.ts` (not `.d.ts`) so esbuild can resolve it as a real (empty-at-runtime) module
import './types/jspdf-autotable';

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
export { resolveColumnAlign, isColumnVisible } from './types/column';

export type {
  TextNode,
  SpacerNode,
  DividerNode,
  ImageNode,
  SignatureSlot,
  SignatureNode,
  GroupResolver,
  ZebraOption,
  TableStyleOptions,
  TableNode,
  RawNode,
  RawDrawCursor,
  StackNode,
  SectionNode,
  RowColumn,
  RowNode,
  KeyValueNode,
  BoxNode,
  BottomAnchorNode,
  ReportNode,
  TextNodeShorthand,
  ReportNodeInput,
} from './types/node';
export { resolveNodeInput } from './types/node';
export { DEFAULT_ROW_GAP } from './blocks/row-block';
export { DEFAULT_BOX_PADDING, DEFAULT_BOX_BORDER_WIDTH } from './blocks/box-block';

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

export type { PageBand, PageBandContext, PageBandRenderer, BlockBand, PageBandLike } from './core/page-band';

export type { Watermark, WatermarkContext, WatermarkRenderer, TextWatermark, WatermarkInput } from './core/watermark';
export {
  withOpacity,
  resolveWatermark,
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_COLOR,
} from './core/watermark';

export { containsThai, isBuiltinStandardFont } from './core/font-guard';

export type { SystemFieldValues } from './core/system-field';
export { resolveSystemFields } from './core/system-field';

export type { Anchor, AnchoredBandOptions } from './core/anchor';
export { DEFAULT_ANCHOR_FONT_SIZE, createAnchoredBand } from './core/anchor';

export type { PageNumberPosition, PageNumberOptions, PageNumberInput } from './core/page-number';
export {
  DEFAULT_PAGE_NUMBER_POSITION,
  DEFAULT_PAGE_NUMBER_FORMAT,
  resolvePageNumber,
  renderPageNumber,
} from './core/page-number';

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
export { createBlock } from './blocks/create-block';

export type { BlockFactory } from './blocks/block-registry';
export { registerBlockType } from './blocks/block-registry';

export { DEFAULT_NUMBER_FORMAT, formatNumber, getNumberFormatter } from './format/number-format';

export type { DateFormat } from './format/date-format';
export { DEFAULT_DATE_FORMAT, formatDate, formatTime, formatDateTime } from './format/date-format';

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

export type { SectionBuilder } from './report/report-registry';
export { ReportRegistry } from './report/report-registry';

export type {
  DataColumnShorthand,
  KapomColumnInput,
  KapomGroupInput,
  KapomDeclarativeBand,
  KapomPageBandInput,
  KapomReportBaseOptions,
  KapomReportConfig,
  KapomBlocksConfig,
  KapomReportInput,
  ResolvedReportConfig,
} from './report/resolve-report-config';
export { resolveReportConfig } from './report/resolve-report-config';

export type { KapomReport } from './report/create-kapom-report';

export { KapomReportBuilder, reportBuilder } from './report/report-builder';
export { createKapomReport } from './report/create-kapom-report';
