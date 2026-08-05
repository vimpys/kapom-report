/**
 * Guards the browser support the README advertises, which nothing else checks: typecheck, lint and
 * the tests all run on Node, where `fs` and `process` exist and nothing is tree-shaken. Both browser
 * bugs this project has had were invisible to all three and only appeared at bundle time:
 *
 *   1. `sideEffects: false` let a bundler drop the built-in block registration, so every block type
 *      threw "is not registered" in the browser while working perfectly in Node.
 *   2. A static `import 'node:fs'` in the facade made the bundle fail outright.
 *
 * So this does two things: bundle for the browser platform (catches #2 and anything like it), then
 * actually run the bundled output and build a report through it (catches #1 — a bundle that drops
 * registration still builds cleanly, and only fails when something tries to use it).
 *
 * Run with `npm run check:browser`; CI runs it after the build.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const dist = join(root, 'dist', 'index.js');
// ต้องอยู่ใต้โปรเจกต์ ไม่ใช่ os.tmpdir(): bundle ยัง import jspdf แบบ external อยู่ (ตรงกับที่ผู้ใช้จริงทำ
// คือมี jspdf เป็น peer ของตัวเอง) Node จึงต้องเดินขึ้นไปหา node_modules ของโปรเจกต์ให้เจอ
const work = mkdtempSync(join(root, 'node_modules', '.kapom-browser-check-'));

function fail(message, detail) {
  console.error(`\n✖ browser bundle check failed: ${message}\n`);
  if (detail) console.error(detail);
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}

try {
  // เรียกใช้ทุก entry point ที่ผู้ใช้ฝั่ง browser จะเรียก — ถ้ามี Node builtin หลุดเข้ามาในเส้นทางไหน bundle จะพัง
  const entry = join(work, 'entry.mjs');
  writeFileSync(
    entry,
    // esbuild resolves plain paths, not file:// URLs — forward slashes keep it valid on Windows too
    `import { createKapomReport, reportBuilder } from ${JSON.stringify(dist.replace(/\\/g, '/'))};
     export function build() {
       const report = createKapomReport({ columns: [{ key: 'a', header: 'A' }], data: [{ a: 1 }] });
       reportBuilder().title('t').table({ columns: [{ key: 'a', header: 'A' }], data: [{ a: 1 }] });

       return report.doc.getNumberOfPages();
     }`,
  );

  const bundle = join(work, 'bundle.mjs');
  try {
    execFileSync(
      process.execPath,
      [
        join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
        entry,
        '--bundle',
        '--platform=browser',
        '--format=esm',
        '--external:jspdf',
        '--external:jspdf-autotable',
        `--outfile=${bundle}`,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  } catch (error) {
    fail('esbuild could not bundle dist/ for the browser platform', error.stderr || error.stdout);
  }

  // build จริงผ่าน bundle — ถ้า tree-shaking ตัดการลงทะเบียน block ทิ้ง ตรงนี้จะ throw "is not registered"
  const { build } = await import(pathToFileURL(bundle).href);
  const pages = build();
  if (typeof pages !== 'number' || pages < 1) {
    fail(`the bundled build produced ${String(pages)} pages`);
  }

  console.log(`✅ browser bundle ok — bundled for platform=browser and rendered ${pages} page(s) through it`);
} catch (error) {
  fail('the bundled output threw when building a report', error instanceof Error ? error.stack : String(error));
} finally {
  rmSync(work, { recursive: true, force: true });
}
