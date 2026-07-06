/**
 * Node-only I/O for the facade — loads builtins via `process.getBuiltinModule()` (Node >= 22.3)
 * instead of a static `import 'node:fs'`, so no `node:` specifier is left lingering in the module
 * graph at all — a browser bundler (Vite/webpack/esbuild) can then bundle this without needing
 * a shim or conditional exports (code in the Node branch never runs in the browser, since callers always check isNodeRuntime() first)
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

/** minimum age of a temp file before it's cleared (review fix #7) — anything newer is assumed to possibly still be open in a viewer */
export const TEMP_PDF_MAX_AGE_MS = 60 * 60 * 1000;

const TEMP_PDF_PATTERN = /^kapom-report-\d+\.pdf$/;

/**
 * Clears old temp PDFs from previous preview() calls (best effort — must never throw):
 * only deletes files matching our own pattern that are older than TEMP_PDF_MAX_AGE_MS; a file
 * locked by a viewer (e.g. Acrobat on Windows) that fails to unlink is skipped silently, to be retried next time
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
        // file is locked, or already gone — skip it (best effort)
      }
    }
  } catch {
    // couldn't read tmpdir — skip cleanup, doesn't affect preview
  }
}

/** writes the PDF to a temp file with a unique (timestamped) name and returns the path — clears old files first, every time */
export function writeTempPdf(data: Uint8Array): string {
  cleanupOldTempPdfs();
  const os = process.getBuiltinModule('node:os');
  const path = process.getBuiltinModule('node:path');
  const file = path.join(os.tmpdir(), `kapom-report-${Date.now()}.pdf`);
  writeFile(file, data);
  return file;
}

/** opens a file with the OS's default program — detaches the process so it doesn't block or tie its lifetime to Node */
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
