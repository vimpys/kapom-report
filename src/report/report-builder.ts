import type { PageBandRenderer } from '../core/page-band';
import type { ReportNodeInput } from '../types/node';
import { createKapomReport } from './create-kapom-report';
import type { KapomReport } from './create-kapom-report';
import { resolveTableNode } from './resolve-report-config';
import type {
  KapomBlocksConfig,
  KapomPageBandInput,
  KapomReportBaseOptions,
  KapomTableInput,
} from './resolve-report-config';

/** a config field without its `undefined` (the builder methods always set a value) */
type Opt<K extends keyof KapomReportBaseOptions> = NonNullable<KapomReportBaseOptions[K]>;

/**
 * Sub-builder for a page-frame band (page header / footer) — a band reserves space on every page,
 * so it has its own config beyond just blocks: add blocks incrementally with `addBlock()`, and the
 * reserved height is auto-measured from them (no magic number) unless you pin it with `height()`.
 * Empty = no band. For a layout the block tree can't express, drop to a raw `render()` callback.
 */
export class BandBuilder {
  // not generic in T — a band can't hold a table/section (rejected at build), only layout blocks,
  // none of which depend on the row type; a TableNode<T> is (correctly) not assignable here
  private readonly blocks: ReportNodeInput[] = [];
  private customHeight: number | undefined;
  private firstPage = true;
  private rawRender: PageBandRenderer | undefined;

  /** append one or more blocks to the band (row / image / text / divider …) */
  addBlock(...blocks: ReportNodeInput[]): this {
    this.blocks.push(...blocks);
    return this;
  }

  /** pin the reserved height (mm) — default: auto-measured from the blocks */
  height(mm: number): this {
    this.customHeight = mm;
    return this;
  }

  /** draw on the first page too? — default true */
  showOnFirstPage(show: boolean): this {
    this.firstPage = show;
    return this;
  }

  /** raw jsPDF escape hatch — draw the band yourself; a height is required (can't auto-measure a callback) */
  render(callback: PageBandRenderer, height: number): this {
    this.rawRender = callback;
    this.customHeight = height;
    return this;
  }

  /** the band config, or undefined if nothing was configured */
  toBand(): KapomPageBandInput | undefined {
    const firstPage = this.firstPage ? {} : { showOnFirstPage: false as const };
    if (this.rawRender) {
      return { height: this.customHeight ?? 0, render: this.rawRender, ...firstPage };
    }
    if (this.blocks.length === 0) return undefined;
    return {
      ...(this.customHeight !== undefined ? { height: this.customHeight } : {}),
      children: this.blocks,
      ...firstPage,
    };
  }
}

/**
 * Fluent report builder — the chain counterpart to the object-config `createKapomReport`, shaped
 * around the report anatomy. Band sections that reserve space are sub-builders you configure in
 * detail (`report.pageHeader.addBlock(...)`); the flowing/once sections and settings are methods
 * (`report.content(...)`, `report.pageNumber(...)`). `build()` emits the exact same config the
 * object form takes, so both produce an identical report.
 *
 * Method/section names follow the anatomy: no `page` prefix = printed once (`title` first page,
 * `summary` last page); a `page` prefix = repeated every page. `content` flows across pages.
 */
export class KapomReportBuilder<T = unknown> {
  /** page header band — repeats every page; `report.pageHeader.addBlock(...)` (height auto-measured) */
  readonly pageHeader = new BandBuilder();
  /** page footer band — repeats every page */
  readonly pageFooter = new BandBuilder();

  private readonly titleBlocks: ReportNodeInput<T>[] = [];
  private readonly bodyBlocks: ReportNodeInput<T>[] = [];
  private readonly summaryBlocks: ReportNodeInput<T>[] = [];
  private readonly options: Partial<KapomReportBaseOptions> = {};

  // ── flow + once sections (methods, chainable) ─────────────────
  /** report title (once, first page) — a plain string becomes a `reportTitle` text + spacer; a node is prepended as-is */
  title(block: string | ReportNodeInput<T>): this {
    if (typeof block === 'string') {
      this.titleBlocks.push({ type: 'text', content: block, role: 'reportTitle' }, { type: 'spacer', height: 6 });
    } else {
      this.titleBlocks.push(block);
    }
    return this;
  }

  /** the content/detail — appended in order; flows and paginates. Repeatable. */
  content(...blocks: ReportNodeInput<T>[]): this {
    this.bodyBlocks.push(...blocks);
    return this;
  }

  /**
   * Add a table from the single-table config — the same Progressive-Disclosure shorthands the
   * object form takes: column `{ key, header }`, group string / `['region','category']` array,
   * column groups (children may use shorthand too), master-detail (`nested`), plus style /
   * summaryLabel / noDataText. Appended to the content flow at the call site (interleaves with
   * `.content(...)`), so it renders below `.title()`.
   *
   * Repeatable — each call adds one table, in call order (drop a `.content(pageBreak())` between
   * them to start a new page). All tables share the builder's single `T`; mixing different row
   * types still needs `.content(TableNode)` + a cast, since one generic can't cover several types.
   */
  table(config: KapomTableInput<T>): this {
    // cast: TableNode<T> is invariant in T (DataColumn.key: keyof T), so it isn't directly
    // assignable to ReportNodeInput<T> — narrowed at this one contained site, same as untyped()
    this.bodyBlocks.push(resolveTableNode(config) as ReportNodeInput<T>);
    return this;
  }

  /** report footer / summary (once, last page) — pinned to the page bottom (wrapped in a bottomAnchor at build). Repeatable. */
  summary(...blocks: ReportNodeInput<T>[]): this {
    this.summaryBlocks.push(...blocks);
    return this;
  }

  // ── page-frame annotations + settings (methods) ───────────────
  pageNumber(input: Opt<'pageNumber'>): this {
    this.options.pageNumber = input;
    return this;
  }

  watermark(input: Opt<'watermark'>): this {
    this.options.watermark = input;
    return this;
  }

  /** paper size / orientation / unit + margins in one place; splits internally (format/orientation/unit → jsPDF, margins → layout) */
  pageSetup(setup: Opt<'document'> & { margins?: Opt<'margins'> }): this {
    const { margins, ...document } = setup;
    if (margins !== undefined) this.options.margins = margins;
    if (Object.keys(document).length > 0) this.options.document = document;
    return this;
  }

  font(config: Opt<'font'>): this {
    this.options.font = config;
    return this;
  }

  margins(margins: Opt<'margins'>): this {
    this.options.margins = margins;
    return this;
  }

  document(document: Opt<'document'>): this {
    this.options.document = document;
    return this;
  }

  numeric(numeric: Opt<'numeric'>): this {
    this.options.numeric = numeric;
    return this;
  }

  typography(typography: Opt<'typography'>): this {
    this.options.typography = typography;
    return this;
  }

  /** ready-made colour scheme (preset name or a `Theme` object) — drives every table fill */
  theme(theme: Opt<'theme'>): this {
    this.options.theme = theme;
    return this;
  }

  // ── output ────────────────────────────────────────────────────
  /** the assembled config — the same shape the object form takes (title first, body, summary pinned to the bottom last) */
  toConfig(): KapomBlocksConfig<T> {
    const blocks: ReportNodeInput<T>[] = [
      ...this.titleBlocks,
      ...this.bodyBlocks,
      ...(this.summaryBlocks.length > 0
        ? [{ type: 'bottomAnchor', children: this.summaryBlocks } as ReportNodeInput<T>]
        : []),
    ];
    const pageHeader = this.pageHeader.toBand();
    const pageFooter = this.pageFooter.toBand();
    return {
      ...this.options,
      ...(pageHeader !== undefined ? { pageHeader } : {}),
      ...(pageFooter !== undefined ? { pageFooter } : {}),
      blocks,
    };
  }

  /** compile to a KapomReport (raw jsPDF doc + save/preview) — identical to createKapomReport(toConfig()) */
  build(): KapomReport {
    return createKapomReport<T>(this.toConfig());
  }

  /** build then write the PDF — returns the KapomReport so you can keep the doc/preview */
  save(filename: string): KapomReport {
    const report = this.build();
    report.save(filename);
    return report;
  }

  /** build then open the PDF in the OS viewer (Node) / a new tab (browser) */
  preview(): KapomReport {
    const report = this.build();
    report.preview();
    return report;
  }
}

/** start a fluent report — the chain counterpart to the object-config `createKapomReport` */
export function reportBuilder<T = unknown>(): KapomReportBuilder<T> {
  return new KapomReportBuilder<T>();
}
