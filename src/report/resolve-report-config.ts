import type { jsPDFOptions } from 'jspdf';
import { createBlock } from '../blocks/create-block';
import { assertConfinedChildAllowed } from '../blocks/row-block';
import { KapomError } from '../core/errors';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { PageMargins } from '../core/context';
import type { PageBand, PageBandLike } from '../core/page-band';
import type { PageNumberInput } from '../core/page-number';
import type { WatermarkInput } from '../core/watermark';
import type { ThemeInput } from '../theme/theme';
import type { RenderEngineOptions } from '../core/engine';
import type { FontConfig } from '../font/font-config';
import type { DeepPartial, HAlign } from '../types/primitives';
import type { Typography } from '../types/typography';
import type { DataColumnShorthand, ReportColumn, TableColumn } from '../types/column';
import type { GroupResolver, ReportNode, ReportNodeInput, SpacerNode, TableNode, TableStyleOptions, TextNode } from '../types/node';

/** the spacer height under a report title (the once-at-top region) */
const DEFAULT_TITLE_SPACER_HEIGHT = 6;

/** the report title as blocks — a `reportTitle` text + a spacer; shared by this facade and the fluent builder so `title` behaves identically in both */
export function reportTitleBlocks(title: string): [TextNode, SpacerNode] {
  return [
    { type: 'text', content: title, role: 'reportTitle' },
    { type: 'spacer', height: DEFAULT_TITLE_SPACER_HEIGHT },
  ];
}

/**
 * A column group whose children may themselves use the `{ key, header }` shorthand (recursively) —
 * the shorthand-aware input counterpart of `ColumnGroup`. Lets the single-table config / `.table()`
 * express multi-level spanned headers, same as a full `TableNode`.
 */
export interface KapomColumnGroupInput<T> {
  type: 'group';
  header: string;
  /** super-header cell alignment — default 'center' */
  headerAlign?: HAlign;
  columns: readonly KapomColumnInput<T>[];
}

/** layer 1: the shorthand `{ key, header }`; a full ReportColumn (rowNumber/computed/runningTotal need `type`); or a column group (children may use shorthand too) */
export type KapomColumnInput<T> = ReportColumn<T> | DataColumnShorthand<T> | KapomColumnGroupInput<T>;

/**
 * layer 2: a simple string key group, or an array of keys = a nested group ordered outer→inner;
 * layer 3: a full GroupResolver (function `by` + label/sort/keepTogether + its own subGroup chain)
 */
export type KapomGroupInput<T> = keyof T | readonly (keyof T)[] | GroupResolver<T>;

/**
 * a page header/footer as a declarative block tree — no raw `doc` callback needed. `children`
 * render into the band's reserved zone on every page (via a confined context), the same block
 * types you use in `blocks`. Restricted like a row/box column: no table/section inside (they'd
 * paginate within a fixed zone). Use the full `PageBand` (render callback) only when you need
 * raw jsPDF drawing the tree can't express.
 */
export interface KapomDeclarativeBand {
  /** reserved zone height (mm); omit = auto-measured from the children's total height */
  height?: number;
  children: readonly ReportNodeInput<unknown>[];
  /** draw on the first page too? — default true */
  showOnFirstPage?: boolean;
}

/** a band is either a declarative block tree (layer 1/2) or a raw render callback (layer 3 escape hatch) */
export type KapomPageBandInput = KapomDeclarativeBand | PageBand;

/** report-level options shared by both the single-table config and the blocks config */
export interface KapomReportBaseOptions {
  typography?: DeepPartial<Typography>;
  /** ready-made colour scheme (preset name or a `Theme` object) — drives every table fill; omit = the default blue/grey look */
  theme?: ThemeInput;
  font?: FontConfig;
  margins?: Partial<PageMargins>;
  numeric?: NumericStrategy;
  pageHeader?: KapomPageBandInput;
  pageFooter?: KapomPageBandInput;
  /** a preset `{ text: 'DRAFT', ... }` or a full render callback (escape hatch) */
  watermark?: WatermarkInput;
  /** a lightweight page-number annotation drawn inside the page margin — doesn't reduce content area (unlike pageHeader/pageFooter); `true` for the default (bottom-left), a position string, or a full object */
  pageNumber?: PageNumberInput;
  /** passed straight into `new jsPDF(options)` — orientation/format/unit etc. (omit = jsPDF's own default, a4/portrait/mm) */
  document?: jsPDFOptions;
}

export interface KapomReportConfig<T> extends KapomReportBaseOptions {
  columns: readonly KapomColumnInput<T>[];
  data: readonly T[];
  /** rendered as a text block with role: 'reportTitle' above the table — omit for no title */
  title?: string;
  group?: KapomGroupInput<T>;
  style?: TableStyleOptions<T>;
  summaryLabel?: string;
  /** message shown when `data` is empty — default 'No data' (DEFAULT_NO_DATA_TEXT) */
  noDataText?: string;
  /** master-detail: a sub-table per row (see TableNode.nested) — mutually exclusive with `group` (throws if both set) */
  nested?: NonNullable<TableNode<T>['nested']>;
  /** how a nested child lays out — 'stacked' (default) or 'below' (see TableNode.nestedLayout) */
  nestedLayout?: NonNullable<TableNode<T>['nestedLayout']>;
  /** 0-based master column the 'below' child's left edge aligns to (see TableNode.nestedIndentColumn) */
  nestedIndentColumn?: NonNullable<TableNode<T>['nestedIndentColumn']>;
}

/**
 * The table-specific fields of a single-table config — report-level options (theme/font/…) are
 * builder methods and `title` is `.title()`, so both are omitted. Used by `reportBuilder().table()`
 * so the builder gets the same Progressive-Disclosure shorthands the single-table config has.
 */
export type KapomTableInput<T> = Omit<KapomReportConfig<T>, keyof KapomReportBaseOptions | 'title'>;

/**
 * Full layer 3: pass a ReportNode tree directly (text/stack/section/signature/table freely
 * mixed, including a SectionNode[] from ReportRegistry.build) — the facade still wires up
 * jsPDF/RenderEngine/finalize exactly like the single-table config, just without composing the tree for you.
 */
export interface KapomBlocksConfig<T = unknown> extends KapomReportBaseOptions {
  /** also accepts text shorthand — a plain string, or `{ content, role?, style? }` without `type`, is a text node */
  blocks: readonly ReportNodeInput<T>[];
}

/** the config createKapomReport accepts — either single-table (columns+data) or a blocks tree directly */
export type KapomReportInput<T> = KapomReportConfig<T> | KapomBlocksConfig<T>;

export interface ResolvedReportConfig<T> {
  /** may contain text shorthand — createBlock() normalizes it at dispatch time */
  blocks: readonly ReportNodeInput<T>[];
  engineOptions: RenderEngineOptions;
  documentOptions: jsPDFOptions | undefined;
}

function isColumnGroupInput<T>(input: KapomColumnInput<T>): input is KapomColumnGroupInput<T> {
  return 'type' in input && input.type === 'group';
}

function isShorthandColumn<T>(input: ReportColumn<T> | DataColumnShorthand<T>): input is DataColumnShorthand<T> {
  return !('type' in input);
}

/** normalize one input column into a resolved TableColumn — a group recurses into its children, a shorthand gets `type: 'data'`, a full column passes through */
function resolveColumn<T>(input: KapomColumnInput<T>): TableColumn<T> {
  if (isColumnGroupInput(input)) {
    return { ...input, columns: input.columns.map(resolveColumn) };
  }

  return isShorthandColumn(input) ? { ...input, type: 'data' } : input;
}

/** Array.isArray can't narrow a readonly array out of a union on its own (a TS limitation) — needs an explicit predicate */
function isGroupKeyArray<T>(input: KapomGroupInput<T>): input is readonly (keyof T)[] {
  return Array.isArray(input);
}

function resolveGroup<T>(input: KapomGroupInput<T> | undefined): GroupResolver<T> | undefined {
  if (input === undefined) return undefined;
  // an array = a nested group chain ordered outer→inner, e.g. ['region','category'] → {by:'region', subGroup:{by:'category'}}
  if (isGroupKeyArray(input)) {
    if (input.length === 0) {
      throw new KapomError('group: array must contain at least 1 key (fail-fast against silently ignored config)');
    }

    return input.reduceRight<GroupResolver<T> | undefined>(
      (subGroup, by) => ({ by, ...(subGroup !== undefined ? { subGroup } : {}) }),
      undefined,
    );
  }

  return typeof input === 'object' ? input : { by: input };
}

export function resolveTableNode<T>(config: KapomTableInput<T>): TableNode<T> {
  const group = resolveGroup(config.group);

  return {
    type: 'table',
    columns: config.columns.map(resolveColumn),
    data: config.data,
    ...(group !== undefined ? { group } : {}),
    ...(config.nested !== undefined ? { nested: config.nested } : {}),
    ...(config.nestedLayout !== undefined ? { nestedLayout: config.nestedLayout } : {}),
    ...(config.nestedIndentColumn !== undefined ? { nestedIndentColumn: config.nestedIndentColumn } : {}),
    ...(config.style !== undefined ? { style: config.style } : {}),
    ...(config.summaryLabel !== undefined ? { summaryLabel: config.summaryLabel } : {}),
    ...(config.noDataText !== undefined ? { noDataText: config.noDataText } : {}),
  };
}

/** a declarative band (has `children`) → resolve into a BlockBand; a raw PageBand passes through */
function resolveBand(band: KapomPageBandInput): PageBandLike {
  if (!('children' in band)) return band;
  for (const child of band.children) assertConfinedChildAllowed(child, 'page band');
  return {
    ...(band.height !== undefined ? { height: band.height } : {}), // omit = engine auto-measures
    blocks: band.children.map((child) => createBlock(child)),
    ...(band.showOnFirstPage !== undefined ? { showOnFirstPage: band.showOnFirstPage } : {}),
  };
}

function resolveEngineOptions(config: KapomReportBaseOptions): RenderEngineOptions {
  return {
    ...(config.margins !== undefined ? { margins: config.margins } : {}),
    ...(config.numeric !== undefined ? { numeric: config.numeric } : {}),
    ...(config.font !== undefined ? { font: config.font } : {}),
    ...(config.typography !== undefined ? { typography: config.typography } : {}),
    ...(config.theme !== undefined ? { theme: config.theme } : {}),
    ...(config.pageHeader !== undefined ? { pageHeader: resolveBand(config.pageHeader) } : {}),
    ...(config.pageFooter !== undefined ? { pageFooter: resolveBand(config.pageFooter) } : {}),
    ...(config.watermark !== undefined ? { watermark: config.watermark } : {}),
    ...(config.pageNumber !== undefined ? { pageNumber: config.pageNumber } : {}),
  };
}

/** the blocks variant has no columns — used to distinguish the two config shapes at runtime (mutually exclusive by type) */
function isBlocksConfig<T>(config: KapomReportInput<T>): config is KapomBlocksConfig<T> {
  return 'blocks' in config;
}

/**
 * Progressive Disclosure layers 1/2/3 always convert into the same ReportNode tree — pure,
 * doesn't touch jsPDF (createKapomReport() is the layer that wires up the real jsPDF/RenderEngine after this);
 * the blocks variant passes the tree through directly without composing anything further (full layer 3)
 */
export function resolveReportConfig<T>(config: KapomReportInput<T>): ResolvedReportConfig<T> {
  const engineOptions = resolveEngineOptions(config);
  const documentOptions = config.document;

  if (isBlocksConfig(config)) {
    return { blocks: config.blocks, engineOptions, documentOptions };
  }

  const tableNode = resolveTableNode(config);
  const blocks: ReportNode<T>[] =
    config.title !== undefined ? [...reportTitleBlocks(config.title), tableNode] : [tableNode];

  return { blocks, engineOptions, documentOptions };
}
