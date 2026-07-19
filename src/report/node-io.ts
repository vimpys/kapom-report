/**
 * Node-only I/O for the facade — loads builtins via `process.getBuiltinModule()` (Node >= 22.3)
 * instead of a static `import 'node:fs'`, so no `node:` specifier is left lingering in the module
 * graph at all — a browser bundler (Vite/webpack/esbuild) can then bundle this without needing
 * a shim or conditional exports (code in the Node branch never runs in the browser, since callers always check isNodeRuntime() first)
 */

import { KapomError } from '../core/errors';

/** true on any Node.js, regardless of version (has a `process.versions.node`) */
function isNodeProcess(): boolean {
  return typeof process !== 'undefined' && typeof process.versions?.node === 'string';
}

/** Node with the builtin-module loader (>= 22.3) — the only Node we can actually do file I/O in */
export function isNodeRuntime(): boolean {
  return isNodeProcess() && typeof process.getBuiltinModule === 'function';
}

/**
 * Guards save()/preview() against a too-old Node: they use `process.getBuiltinModule` (added in
 * Node 22.3), so on an older Node (a Node process without it) isNodeRuntime() is false and the
 * caller would otherwise fall through to jsPDF's browser-only path and crash with a confusing
 * "document is not defined". Throw a clear, actionable error instead. No-op in the browser (not a
 * Node process) — the browser path is legitimate there.
 */
export function assertNodeIoSupported(op: 'save' | 'preview'): void {
  if (isNodeProcess() && typeof process.getBuiltinModule !== 'function') {
    throw new KapomError(
      `${op}() needs Node >= 22.3 for file I/O (running Node ${process.versions.node}). On older ` +
        `Node, get the bytes with report.doc.output('arraybuffer') and write the file yourself.`,
    );
  }
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
  const child = spawn(command.cmd, command.args, { detached: true, stdio: 'ignore' });
  // best effort: a missing/failed launcher (e.g. no xdg-open on a headless server) emits an async
  // 'error' — swallow it so it never becomes an uncaught exception that crashes the caller
  child.on('error', () => {});
  child.unref();
}
