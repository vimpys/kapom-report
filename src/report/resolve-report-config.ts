import type { jsPDFOptions } from 'jspdf';
import { KapomError } from '../core/errors';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { PageMargins } from '../core/context';
import type { PageBand } from '../core/page-band';
import type { Watermark } from '../core/watermark';
import type { RenderEngineOptions } from '../core/engine';
import type { FontConfig } from '../font/font-config';
import type { DeepPartial } from '../types/primitives';
import type { Typography } from '../types/typography';
import type { DataColumn, ReportColumn } from '../types/column';
import type { GroupResolver, ReportNode, TableNode, TableStyleOptions } from '../types/node';

/** ไม่ใส่ `type` → normalize เป็น DataColumn ใน resolveReportConfig() (progressive disclosure ชั้น 1) */
export type DataColumnShorthand<T> = Omit<DataColumn<T>, 'type'>;

/** ชั้น 1: shorthand `{ key, header }`; ชั้น 3: ReportColumn เต็มรูป (rowNumber/computed/runningTotal ก็ยังต้องระบุ type) */
export type KapomColumnInput<T> = ReportColumn<T> | DataColumnShorthand<T>;

/**
 * ชั้น 2: string key group ง่ายๆ หรือ array ของ key = nested group เรียงนอก→ใน (roadmap 10);
 * ชั้น 3: GroupResolver เต็มรูป (function by + label/sort/keepTogether + subGroup chain เอง)
 */
export type KapomGroupInput<T> = keyof T | readonly (keyof T)[] | GroupResolver<T>;

/** option ระดับ report ที่ใช้ร่วมกันทั้ง config แบบ single-table และแบบ blocks */
export interface KapomReportBaseOptions {
  typography?: DeepPartial<Typography>;
  font?: FontConfig;
  margins?: Partial<PageMargins>;
  numeric?: NumericStrategy;
  pageHeader?: PageBand;
  pageFooter?: PageBand;
  watermark?: Watermark;
  /** ส่งตรงเข้า `new jsPDF(options)` — orientation/format/unit ฯลฯ (ไม่ใส่ = default ของ jsPDF เอง คือ a4/portrait/mm) */
  document?: jsPDFOptions;
}

export interface KapomReportConfig<T> extends KapomReportBaseOptions {
  columns: readonly KapomColumnInput<T>[];
  data: readonly T[];
  /** แสดงเป็น text block role: 'reportTitle' เหนือตาราง — ไม่ใส่ = ไม่มี title */
  title?: string;
  group?: KapomGroupInput<T>;
  style?: TableStyleOptions<T>;
  summaryLabel?: string;
}

/**
 * ชั้น 3 เต็มรูป: ส่ง ReportNode tree ตรงๆ (text/stack/section/signature/table ผสมกันอิสระ
 * รวมถึง SectionNode[] จาก ReportRegistry.build) — facade ยัง wire jsPDF/RenderEngine/finalize ให้
 * เหมือน config แบบ single-table ทุกประการ ต่างแค่ไม่ประกอบ tree ให้
 */
export interface KapomBlocksConfig<T = unknown> extends KapomReportBaseOptions {
  blocks: readonly ReportNode<T>[];
}

/** config ที่ createKapomReport รับ — single-table (columns+data) หรือ blocks tree ตรงๆ */
export type KapomReportInput<T> = KapomReportConfig<T> | KapomBlocksConfig<T>;

export interface ResolvedReportConfig<T> {
  blocks: readonly ReportNode<T>[];
  engineOptions: RenderEngineOptions;
  documentOptions: jsPDFOptions | undefined;
}

function isShorthandColumn<T>(input: KapomColumnInput<T>): input is DataColumnShorthand<T> {
  return !('type' in input);
}

function resolveColumn<T>(input: KapomColumnInput<T>): ReportColumn<T> {
  return isShorthandColumn(input) ? { ...input, type: 'data' } : input;
}

/** Array.isArray narrow readonly array ออกจาก union เองไม่ได้ (TS limitation) — ต้องมี predicate */
function isGroupKeyArray<T>(input: KapomGroupInput<T>): input is readonly (keyof T)[] {
  return Array.isArray(input);
}

function resolveGroup<T>(input: KapomGroupInput<T> | undefined): GroupResolver<T> | undefined {
  if (input === undefined) return undefined;
  // array = nested group chain เรียงนอก→ใน เช่น ['region','category'] → {by:'region', subGroup:{by:'category'}}
  if (isGroupKeyArray(input)) {
    if (input.length === 0) {
      throw new KapomError('group: array ต้องมี key อย่างน้อย 1 ตัว (fail-fast กัน config เงียบๆ)');
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

/** blocks variant ไม่มี columns — ใช้แยกสองรูปแบบ config ตอน runtime (mutually exclusive โดย type) */
function isBlocksConfig<T>(config: KapomReportInput<T>): config is KapomBlocksConfig<T> {
  return 'blocks' in config;
}

/**
 * ชั้น 1/2/3 ของ Progressive Disclosure แปลงเป็น ReportNode tree เดียวกันเสมอ — pure,
 * ไม่แตะ jsPDF (createKapomReport() เป็นชั้นที่ wire jsPDF/RenderEngine จริงต่อจากนี้);
 * blocks variant ผ่าน tree ตรงโดยไม่ประกอบเพิ่ม (ชั้น 3 เต็มรูป)
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
