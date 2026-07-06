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

/** เขียน PDF ลง temp file ชื่อไม่ซ้ำ (timestamp) แล้วคืน path */
export function writeTempPdf(data: Uint8Array): string {
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
