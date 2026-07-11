import type { ReportNodeInput } from '../types/node';
import { createKapomReport } from './create-kapom-report';
import type { KapomReport } from './create-kapom-report';
import type { KapomBlocksConfig, KapomReportBaseOptions } from './resolve-report-config';

/** a config field without its `undefined` (the builder methods always set a value) */
type Opt<K extends keyof KapomReportBaseOptions> = NonNullable<KapomReportBaseOptions[K]>;

/**
 * Fluent chain over `createKapomReport` — the optional convenience layer from concept.md. It
 * accumulates blocks/options and, on `build()`, emits the exact same `{ blocks, ... }` config the
 * object form takes, so both produce an identical report (no behavior only reachable one way).
 *
 * Method names follow the report anatomy so each one says *when* it shows: no `page` prefix =
 * printed once (`title` first page, `summary` last page); a `page` prefix = repeated every page
 * (`pageHeader`/`pageFooter`/`pageNumber`). `content` is the body that flows across pages.
 */
export class KapomReportBuilder<T = unknown> {
  private readonly titleBlocks: ReportNodeInput<T>[] = [];
  private readonly bodyBlocks: ReportNodeInput<T>[] = [];
  private readonly summaryBlocks: ReportNodeInput<T>[] = [];
  private readonly options: Partial<KapomReportBaseOptions> = {};

  // ── printed once ──────────────────────────────────────────────
  /** report title (once, first page) — a plain string becomes a `reportTitle` text + spacer; a node is prepended as-is. Repeatable. */
  title(block: string | ReportNodeInput<T>): this {
    if (typeof block === 'string') {
      this.titleBlocks.push({ type: 'text', content: block, role: 'reportTitle' }, { type: 'spacer', height: 6 });
    } else {
      this.titleBlocks.push(block);
    }
    return this;
  }

  /** report footer / summary (once, last page) — pinned to the page bottom (wrapped in a bottomAnchor at build). Repeatable. */
  summary(...blocks: ReportNodeInput<T>[]): this {
    this.summaryBlocks.push(...blocks);
    return this;
  }

  // ── the body (flows across pages) ─────────────────────────────
  /** the content/detail — appended in order; flows and paginates. Call multiple times to keep adding. */
  content(...blocks: ReportNodeInput<T>[]): this {
    this.bodyBlocks.push(...blocks);
    return this;
  }

  // ── repeated every page (the page frame) ──────────────────────
  pageHeader(band: Opt<'pageHeader'>): this {
    this.options.pageHeader = band;
    return this;
  }

  pageFooter(band: Opt<'pageFooter'>): this {
    this.options.pageFooter = band;
    return this;
  }

  pageNumber(input: Opt<'pageNumber'>): this {
    this.options.pageNumber = input;
    return this;
  }

  watermark(input: Opt<'watermark'>): this {
    this.options.watermark = input;
    return this;
  }

  // ── page setup ────────────────────────────────────────────────
  /**
   * paper size / orientation / unit + margins in one place (the "Page Setup" grouping) — e.g.
   * `.pageSetup({ format: 'a4', orientation: 'landscape', margins: { top: 20, ... } })`. Splits
   * internally: `format`/`orientation`/`unit` go to `new jsPDF()`, `margins` to the layout engine.
   * `.document()` / `.margins()` remain as the granular equivalents.
   */
  pageSetup(setup: Opt<'document'> & { margins?: Opt<'margins'> }): this {
    const { margins, ...document } = setup;
    if (margins !== undefined) this.options.margins = margins;
    if (Object.keys(document).length > 0) this.options.document = document;
    return this;
  }

  // ── report-wide settings ──────────────────────────────────────
  font(config: Opt<'font'>): this {
    this.options.font = config;
    return this;
  }

  margins(margins: Opt<'margins'>): this {
    this.options.margins = margins;
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

  document(document: Opt<'document'>): this {
    this.options.document = document;
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
    return { ...this.options, blocks };
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
