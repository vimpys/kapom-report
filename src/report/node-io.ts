/**
 * Node-only I/O ของ facade — โหลด builtin ผ่าน `process.getBuiltinModule()` (Node >= 22.3)
 * แทน static `import 'node:fs'` เพื่อไม่ให้มี node: specifier ค้างใน module graph เลย —
 * bundler ฝั่ง browser (Vite/webpack/esbuild) จึง bundle ผ่านโดยไม่ต้อง shim/conditional exports
 * (โค้ดใน branch Node ไม่มีวันรันบน browser เพราะ caller เช็ค isNodeRuntime() ก่อนเสมอ)
 */

export function isNodeRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.versions?.node === 'string' &&
    typeof process.getBuiltinModule === 'function'
  );
}

export function writeFile(filename: string, data: Uint8Array): void {
  const fs = process.getBuiltinModule('node:fs');
  fs.writeFileSync(filename, data);
}

/** อายุขั้นต่ำของ temp file ก่อนถูกเคลียร์ (ค้างแก้ #7) — ใหม่กว่านี้ถือว่า viewer อาจยังเปิดอยู่ */
export const TEMP_PDF_MAX_AGE_MS = 60 * 60 * 1000;

const TEMP_PDF_PATTERN = /^kapom-report-\d+\.pdf$/;

/**
 * เคลียร์ temp PDF เก่าจากการ preview ครั้งก่อนๆ (best effort — ห้าม throw):
 * ลบเฉพาะไฟล์ตาม pattern ของเราที่แก่กว่า TEMP_PDF_MAX_AGE_MS; ไฟล์ที่ viewer
 * lock อยู่ (เช่น Acrobat บน Windows) unlink ไม่ผ่านก็ข้ามเงียบๆ รอรอบถัดไป
 */
function cleanupOldTempPdfs(): void {
  const fs = process.getBuiltinModule('node:fs');
  const os = process.getBuiltinModule('node:os');
  const path = process.getBuiltinModule('node:path');
  try {
    const dir = os.tmpdir();
    const now = Date.now();
    for (const name of fs.readdirSync(dir)) {
      if (!TEMP_PDF_PATTERN.test(name)) continue;
      const file = path.join(dir, name);
      try {
        if (now - fs.statSync(file).mtimeMs > TEMP_PDF_MAX_AGE_MS) fs.unlinkSync(file);
      } catch {
        // ไฟล์โดน lock/หายไปแล้ว — ข้าม (best effort)
      }
    }
  } catch {
    // อ่าน tmpdir ไม่ได้ — ข้ามการเคลียร์ ไม่กระทบ preview
  }
}

/** เขียน PDF ลง temp file ชื่อไม่ซ้ำ (timestamp) แล้วคืน path — เคลียร์ไฟล์เก่าให้ก่อนทุกครั้ง */
export function writeTempPdf(data: Uint8Array): string {
  cleanupOldTempPdfs();
  const os = process.getBuiltinModule('node:os');
  const path = process.getBuiltinModule('node:path');
  const file = path.join(os.tmpdir(), `kapom-report-${Date.now()}.pdf`);
  writeFile(file, data);
  return file;
}

/** เปิดไฟล์ด้วยโปรแกรม default ของ OS — detach process ไม่บล็อก/ไม่ผูก lifetime กับ Node */
export function openWithDefaultViewer(file: string): void {
  const { spawn } = process.getBuiltinModule('node:child_process');
  const command =
    process.platform === 'win32'
      ? { cmd: 'cmd', args: ['/c', 'start', '', file] }
      : process.platform === 'darwin'
        ? { cmd: 'open', args: [file] }
        : { cmd: 'xdg-open', args: [file] };
  spawn(command.cmd, command.args, { detached: true, stdio: 'ignore' }).unref();
}
