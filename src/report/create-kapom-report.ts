import { jsPDF } from 'jspdf';
import { RenderEngine } from '../core/engine';
import { createBlock } from '../blocks/create-block';
import { KapomError } from '../core/errors';
import { isNodeRuntime, openWithDefaultViewer, writeFile, writeTempPdf } from './node-io';
import type { KapomReportInput } from './resolve-report-config';
import { resolveReportConfig } from './resolve-report-config';

export interface KapomReport {
  /** raw jsPDF instance — escape hatch ระดับเดียวกับ Watermark/PageBand (ต่อ doc.output()/doc.save() เองได้) */
  readonly doc: jsPDF;
  /**
   * Node: เขียนไฟล์ลง disk; browser: สั่ง download ผ่าน `doc.save()` ของ jsPDF
   * (ชื่อไฟล์เดียวกัน ใช้ได้ทั้งสองฝั่งโดยไม่ต้องแก้โค้ด)
   */
  save(filename: string): void;
  /**
   * Node: เขียน temp file แล้วเปิดด้วย PDF viewer default ของ OS — คืน path ของ temp file;
   * browser: เปิด PDF ใน tab ใหม่ผ่าน blob URL — คืน URL นั้น
   */
  preview(): string;
}

/** window.open โดยไม่ต้องเปิด DOM lib ใน tsconfig — มีจริงเฉพาะฝั่ง browser */
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
 * Public entry point (roadmap 8) — user ไม่ต้องแตะ RenderEngine/createBlock ตรง
 * `createKapomReport({ columns, data, ... }).save('report.pdf')` — zero-config ชั้น 1;
 * column shorthand ({ key, header } ไม่ใส่ type) + group shorthand (string key) + style/typography/font
 * เต็มรูปสำหรับชั้น 2/3 ล้วนแปลงผ่าน resolveReportConfig() เป็น ReportNode tree เดียวกัน;
 * `{ blocks: [...] }` variant = ชั้น 3 เต็มรูป ส่ง ReportNode tree ตรงๆ (multi-section/composite ได้)
 * โดยยังไม่ต้องแตะ jsPDF/RenderEngine/finalize เอง;
 * config.document (orientation/format/unit ฯลฯ) ส่งตรงเข้า `new jsPDF(options)` — ไม่ใส่ = default ของ jsPDF (a4/portrait/mm);
 * universal: ไฟล์นี้ไม่มี static `node:` import — bundle ฝั่ง browser ได้ (Node I/O อยู่ใน node-io.ts
 * โหลดผ่าน process.getBuiltinModule เฉพาะเมื่อรันบน Node จริง)
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
        // jsPDF native doc.save() ใช้ไม่ได้ฝั่ง Node — เขียนไฟล์เองตาม pattern เดิม
        writeFile(filename, pdfBytes());
        return;
      }
      doc.save(filename); // browser: trigger download
    },
    preview(): string {
      if (isNodeRuntime()) {
        const file = writeTempPdf(pdfBytes());
        openWithDefaultViewer(file);
        return file;
      }
      // browser: blob URL + เปิด tab ใหม่ (คืน URL เผื่อ embed ใน <iframe> เอง)
      const url = String(doc.output('bloburl'));
      openInNewTab(url);
      return url;
    },
  };
}
