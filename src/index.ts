// side-effect import — pulls the `jsPDF.lastAutoTable` module augmentation into the published
// .d.ts bundle; tsup's dts bundler only follows the import graph from this entry point, so
// without this the ambient declaration (picked up locally only via tsconfig `include`) never
// ships to consumers — the augmentation file must be a
// plain `.ts` (not `.d.ts`) so esbuild can resolve it as a real (empty-at-runtime) module
import './types/jspdf-autotable';

/**
 * Public API — everything needed to author a report the intended way: the facade
 * (`createKapomReport`/`reportBuilder`), the declarative node tree, columns, theme, font,
 * page frame (header/footer/watermark/page-number), formatting, and errors.
 *
 * Low-level internals — the render engine, cursor, block classes, the pure table pipeline
 * (group tree / aggregate / column width), and plugin authoring (`registerBlockType`) — live in
 * a separate entry: `import { ... } from 'kapom-report/advanced'`. They're stable enough to use,
 * but change more freely than this surface, so they're kept out of the default import.
 */

// ── facade (the primary entry points) ────────────────────────────────────
export type { KapomReport } from './report/create-kapom-report';
export { createKapomReport } from './report/create-kapom-report';
export { KapomReportBuilder, BandBuilder, reportBuilder } from './report/report-builder';

// ── report config (Progressive-Disclosure input types) ───────────────────
export type {
  KapomColumnInput,
  KapomColumnGroupInput,
  KapomGroupInput,
  KapomTableInput,
  KapomDeclarativeBand,
  KapomPageBandInput,
  KapomReportBaseOptions,
  KapomReportConfig,
  KapomBlocksConfig,
  KapomReportInput,
} from './report/resolve-report-config';

// ── multi-section composition ─────────────────────────────────────────────
export type { SectionBuilder } from './report/report-registry';
export { ReportRegistry } from './report/report-registry';

// ── columns ────────────────────────────────────────────────────────────────
export type {
  AggregateFn,
  RowNumberMode,
  DataColumn,
  RowNumberColumn,
  ComputedColumn,
  RunningTotalColumn,
  ReportColumn,
  ColumnGroup,
  TableColumn,
  DataColumnShorthand,
  ResolvedAlign,
  ColumnHelpers,
} from './types/column';
export { normalizeColumn, col } from './types/column';

// ── declarative node tree ───────────────────────────────────────────────────
export type {
  TextNode,
  SpacerNode,
  DividerNode,
  PageBreakNode,
  ImageNode,
  SignatureSlot,
  SignatureNode,
  KeepTogetherPolicy,
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
export { spacer, divider, pageBreak } from './types/node';
export { DEFAULT_ROW_GAP } from './blocks/row-block';
export { DEFAULT_BOX_PADDING, DEFAULT_BOX_BORDER_WIDTH } from './blocks/box-block';

// ── primitives + typography ─────────────────────────────────────────────────
export type {
  HAlign,
  FontStyle,
  RGB,
  DeepPartial,
  TextStyle,
  NumberFormat,
  CellStyle,
} from './types/primitives';
export type { Typography } from './types/typography';
export { DEFAULT_TYPOGRAPHY } from './types/typography';
export type { PageMargins } from './core/context';

// ── theme ────────────────────────────────────────────────────────────────
export type { Theme, ThemeName, ThemeInput } from './theme/theme';
export { THEME_PRESETS } from './theme/theme';

// ── font ────────────────────────────────────────────────────────────────
export type { FontConfig, FontSource, FontVariantStyle } from './font/font-config';
export { registerFonts } from './font/register-fonts';

// ── page frame: header/footer bands, watermark, page number ────────────────
export type { PageBand, PageBandContext, PageBandRenderer } from './core/page-band';
export type {
  Watermark,
  WatermarkContext,
  WatermarkRenderer,
  TextWatermark,
  WatermarkInput,
  WatermarkLayout,
  WatermarkTextOptions,
} from './core/watermark';
export {
  withOpacity,
  DEFAULT_WATERMARK_OPACITY,
  DEFAULT_WATERMARK_FONT_SIZE,
  DEFAULT_WATERMARK_COLOR,
  DEFAULT_WATERMARK_ROTATE,
  DEFAULT_WATERMARK_LAYOUT,
} from './core/watermark';
export type { PageNumberPosition, PageNumberOptions, PageNumberInput } from './core/page-number';
export { DEFAULT_PAGE_NUMBER_POSITION, DEFAULT_PAGE_NUMBER_FORMAT } from './core/page-number';
export type { Anchor, AnchoredBandOptions } from './core/anchor';
export { DEFAULT_ANCHOR_FONT_SIZE, createAnchoredBand } from './core/anchor';
export type { SystemFieldValues } from './core/system-field';
export { resolveSystemFields } from './core/system-field';

// ── text facade (for raw blocks / custom drawing) ──────────────────────────
export type { TextNormalizeOptions } from './core/text-normalizer';
export { normalizeText } from './core/text-normalizer';
export { drawText } from './core/draw-text';

// ── formatting ────────────────────────────────────────────────────────────
export { DEFAULT_NUMBER_FORMAT, formatNumber } from './format/number-format';
export type { DateFormat } from './format/date-format';
export {
  DEFAULT_DATE_FORMAT,
  formatDate,
  formatTime,
  formatDateTime,
  formatTimestamp,
} from './format/date-format';

// ── numeric strategy ────────────────────────────────────────────────────────
export type { Decimalish, NumericStrategy } from './numeric/numeric-strategy';
export { nativeNumeric } from './numeric/numeric-strategy';

// ── errors ────────────────────────────────────────────────────────────────
export { KapomError, KapomLayoutError, KapomFontError } from './core/errors';
