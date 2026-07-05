import { jsPDF } from 'jspdf';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RenderEngine } from '../core/engine';
import { createBlock } from '../blocks/create-block';
import type { KapomReportInput } from './resolve-report-config';
import { resolveReportConfig } from './resolve-report-config';

export interface KapomReport {
  /** raw jsPDF instance — escape hatch ระดับเดียวกับ Watermark/PageBand (ต่อ doc.output()/doc.save() เองได้) */
  readonly doc: jsPDF;
  /** เขียนไฟล์ลง disk (Node เท่านั้น — เหมือน examples/shared.ts save()) */
  save(filename: string): void;
  /**
   * เขียน temp file แล้วเปิดด้วย PDF viewer default ของ OS (Node เท่านั้น) — คืน path ของ temp file;
   * ฝั่ง browser ใช้ `report.doc.output('dataurlnewwindow')` ของ jsPDF ตรงๆ แทน (มี overload พร้อมอยู่แล้ว)
   */
  preview(): string;
}

/** เปิดไฟล์ด้วยโปรแกรม default ของ OS — detach process ไม่บล็อก/ไม่ผูก lifetime กับ Node */
function openWithDefaultViewer(file: string): void {
  const command =
    process.platform === 'win32'
      ? { cmd: 'cmd', args: ['/c', 'start', '', file] }
      : process.platform === 'darwin'
        ? { cmd: 'open', args: [file] }
        : { cmd: 'xdg-open', args: [file] };
  spawn(command.cmd, command.args, { detached: true, stdio: 'ignore' }).unref();
}

/**
 * Public entry point (roadmap 8) — user ไม่ต้องแตะ RenderEngine/createBlock ตรง
 * `createKapomReport({ columns, data, ... }).save('report.pdf')` — zero-config ชั้น 1;
 * column shorthand ({ key, header } ไม่ใส่ type) + group shorthand (string key) + style/typography/font
 * เต็มรูปสำหรับชั้น 2/3 ล้วนแปลงผ่าน resolveReportConfig() เป็น ReportNode tree เดียวกัน;
 * `{ blocks: [...] }` variant = ชั้น 3 เต็มรูป ส่ง ReportNode tree ตรงๆ (multi-section/composite ได้)
 * โดยยังไม่ต้องแตะ jsPDF/RenderEngine/finalize เอง;
 * config.document (orientation/format/unit ฯลฯ) ส่งตรงเข้า `new jsPDF(options)` — ไม่ใส่ = default ของ jsPDF (a4/portrait/mm)
 */
export function createKapomReport<T>(config: KapomReportInput<T>): KapomReport {
  const { blocks, engineOptions, documentOptions } = resolveReportConfig(config);

  const doc = new jsPDF(documentOptions);
  const engine = new RenderEngine(doc, engineOptions);
  engine.render(blocks.map((node) => createBlock(node)));
  engine.finalize();

  const writeTo = (filename: string): void => {
    writeFileSync(filename, Buffer.from(doc.output('arraybuffer')));
  };

  return {
    doc,
    save: writeTo,
    preview(): string {
      // timestamp กันชนกันเมื่อ preview ซ้ำหลายรอบ (viewer บางตัว lock ไฟล์เดิมค้างไว้)
      const file = join(tmpdir(), `kapom-report-${Date.now()}.pdf`);
      writeTo(file);
      openWithDefaultViewer(file);
      return file;
    },
  };
}
