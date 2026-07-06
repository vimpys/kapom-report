import type { jsPDFOptions } from 'jspdf';
import { KapomError } from '../core/errors';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { PageMargins } from '../core/context';
import type { PageBand } from '../core/page-band';
import type { WatermarkInput } from '../core/watermark';
import type { RenderEngineOptions } from '../core/engine';
import type { FontConfig } from '../font/font-config';
import type { DeepPartial } from '../types/primitives';
import type { Typography } from '../types/typography';
import type { DataColumn, ReportColumn } from '../types/column';
import type { GroupResolver, ReportNode, ReportNodeInput, TableNode, TableStyleOptions } from '../types/node';

/** without `type`, normalized into a DataColumn inside resolveReportConfig() (Progressive Disclosure layer 1) */
export type DataColumnShorthand<T> = Omit<DataColumn<T>, 'type'>;

/** layer 1: the shorthand `{ key, header }`; layer 3: a full ReportColumn (rowNumber/computed/runningTotal still need `type`) */
export type KapomColumnInput<T> = ReportColumn<T> | DataColumnShorthand<T>;

/**
 * layer 2: a simple string key group, or an array of keys = a nested group ordered outer→inner (roadmap 10);
 * layer 3: a full GroupResolver (function `by` + label/sort/keepTogether + its own subGroup chain)
 */
export type KapomGroupInput<T> = keyof T | readonly (keyof T)[] | GroupResolver<T>;

/** report-level options shared by both the single-table config and the blocks config */
export interface KapomReportBaseOptions {
  typography?: DeepPartial<Typography>;
  font?: FontConfig;
  margins?: Partial<PageMargins>;
  numeric?: NumericStrategy;
  pageHeader?: PageBand;
  pageFooter?: PageBand;
  /** a preset `{ text: 'DRAFT', ... }` or a full render callback (escape hatch) */
  watermark?: WatermarkInput;
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
}

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

function isShorthandColumn<T>(input: KapomColumnInput<T>): input is DataColumnShorthand<T> {
  return !('type' in input);
}

function resolveColumn<T>(input: KapomColumnInput<T>): ReportColumn<T> {
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

function resolveTableNode<T>(config: KapomReportConfig<T>): TableNode<T> {
  const group = resolveGroup(config.group);

  return {
    type: 'table',
    columns: config.columns.map(resolveColumn),
    data: config.data,
    ...(group !== undefined ? { group } : {}),
    ...(config.style !== undefined ? { style: config.style } : {}),
    ...(config.summaryLabel !== undefined ? { summaryLabel: config.summaryLabel } : {}),
    ...(config.noDataText !== undefined ? { noDataText: config.noDataText } : {}),
  };
}

function resolveEngineOptions(config: KapomReportBaseOptions): RenderEngineOptions {
  return {
    ...(config.margins !== undefined ? { margins: config.margins } : {}),
    ...(config.numeric !== undefined ? { numeric: config.numeric } : {}),
    ...(config.font !== undefined ? { font: config.font } : {}),
    ...(config.typography !== undefined ? { typography: config.typography } : {}),
    ...(config.pageHeader !== undefined ? { pageHeader: config.pageHeader } : {}),
    ...(config.pageFooter !== undefined ? { pageFooter: config.pageFooter } : {}),
    ...(config.watermark !== undefined ? { watermark: config.watermark } : {}),
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
    config.title !== undefined
      ? [{ type: 'text', content: config.title, role: 'reportTitle' }, { type: 'spacer', height: 6 }, tableNode]
      : [tableNode];

  return { blocks, engineOptions, documentOptions };
}
