import { jsPDF } from 'jspdf';
import { RenderEngine } from '../core/engine';
import { createBlock } from '../blocks/create-block';
import { KapomError } from '../core/errors';
import { isNodeRuntime, openWithDefaultViewer, writeFile, writeTempPdf } from './node-io';
import type { KapomReportInput } from './resolve-report-config';
import { resolveReportConfig } from './resolve-report-config';

export interface KapomReport {
  /** raw jsPDF instance — escape hatch at the same level as Watermark/PageBand (call doc.output()/doc.save() yourself) */
  readonly doc: jsPDF;
  /**
   * Node: writes the file to disk; browser: triggers a download via jsPDF's `doc.save()`
   * (same filename, works on both sides without changing your code)
   */
  save(filename: string): void;
  /**
   * Node: writes a temp file and opens it with the OS's default PDF viewer — returns the temp file's path;
   * browser: opens the PDF in a new tab via a blob URL — returns that URL
   */
  preview(): string;
}

/** window.open, without needing the DOM lib in tsconfig — only exists for real in the browser */
function openInNewTab(url: string): void {
  const opener = (globalThis as { open?: (url: string) => unknown }).open;
  if (typeof opener !== 'function') {
    throw new KapomError(
      'preview(): neither a Node runtime nor window.open is available — use report.doc.output(...) directly in this environment',
    );
  }
  opener(url);
}

/**
 * Public entry point (roadmap 8) — the user never needs to touch RenderEngine/createBlock directly
 * `createKapomReport({ columns, data, ... }).save('report.pdf')` — zero-config layer 1;
 * column shorthand ({ key, header } without `type`) + group shorthand (a string key) + full
 * style/typography/font for layers 2/3, all converted through resolveReportConfig() into the same ReportNode tree;
 * the `{ blocks: [...] }` variant is full layer 3 — pass a ReportNode tree directly
 * (multi-section/composite is possible) without ever touching jsPDF/RenderEngine/finalize yourself;
 * config.document (orientation/format/unit etc.) is passed straight into `new jsPDF(options)` —
 * omit it for jsPDF's own default (a4/portrait/mm);
 * universal: this file has no static `node:` import — it can be bundled for the browser (Node
 * I/O lives in node-io.ts, loaded via process.getBuiltinModule only when actually running on Node)
 */
export function createKapomReport<T>(config: KapomReportInput<T>): KapomReport {
  const { blocks, engineOptions, documentOptions } = resolveReportConfig(config);

  const doc = new jsPDF(documentOptions);
  const engine = new RenderEngine(doc, engineOptions);
  engine.render(blocks.map((node) => createBlock(node)));
  engine.finalize();

  const pdfBytes = (): Uint8Array => new Uint8Array(doc.output('arraybuffer'));

  return {
    doc,
    save(filename: string): void {
      if (isNodeRuntime()) {
        // jsPDF's native doc.save() doesn't work on Node — write the file ourselves, same pattern as before
        writeFile(filename, pdfBytes());
        return;
      }
      doc.save(filename); // browser: trigger a download
    },
    preview(): string {
      if (isNodeRuntime()) {
        const file = writeTempPdf(pdfBytes());
        openWithDefaultViewer(file);
        return file;
      }
      // browser: blob URL + open in a new tab (return the URL in case the caller wants to embed it in an <iframe> themselves)
      const url = String(doc.output('bloburl'));
      openInNewTab(url);
      return url;
    },
  };
}
