import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Regression: the block registry must be shared by every copy of block-registry.ts in a process.
 *
 * The package ships two entry points and the CJS build has no code splitting, so `index.cjs` and
 * `advanced.cjs` each embed their own copy of the registry module. While the Map lived in module
 * scope, `registerBlockType` (exported from /advanced) wrote into a different Map than the one
 * `createKapomReport` (main entry) read from, and every plugin block threw "is not registered"
 * for CJS consumers — the documented plugin escape hatch was simply broken under require().
 *
 * Two layers, because neither alone catches it:
 * - the module-copy tests below run always and pin the mechanism (globalThis-keyed registry);
 * - the built-artifact tests reproduce the real consumer scenario end to end, and only they would
 *   have caught the original bug, since it lives in how tsup bundles rather than in the source.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(REPO_ROOT, 'dist');

type RegistryModule = typeof import('../../src/blocks/block-registry');

/** loads a fresh, independently-evaluated instance of block-registry.ts — models one bundled copy */
async function loadRegistryCopy(): Promise<RegistryModule> {
  vi.resetModules();

  return import('../../src/blocks/block-registry');
}

const stubFactory = (): { measureHeight: () => number; render: () => void } => ({
  measureHeight: () => 1,
  render: () => {},
});

describe('block-registry — สอง copy ของ module ต้องใช้ registry ก้อนเดียวกัน', () => {
  it('registerBlockType จาก copy หนึ่ง → createBlock ของอีก copy มองเห็น', async () => {
    const copyA = await loadRegistryCopy();
    const copyB = await loadRegistryCopy();

    // ยืนยันก่อนว่าเป็นคนละ instance จริง — ไม่งั้นเทสต์นี้ผ่านแบบไม่ได้พิสูจน์อะไรเลย
    expect(copyA).not.toBe(copyB);

    const stub = stubFactory();
    copyA.registerBlockType('__cross_copy_probe__', () => stub);

    expect(copyB.hasBlockType('__cross_copy_probe__')).toBe(true);
    expect(copyB.createBlock({ type: '__cross_copy_probe__' } as never)).toBe(stub);
  });

  it('duplicate guard ทำงานข้าม copy ด้วย (ไม่ silent overwrite ข้าม bundle)', async () => {
    const copyA = await loadRegistryCopy();
    const copyB = await loadRegistryCopy();

    copyA.registerBlockType('__cross_copy_duplicate__', stubFactory);

    expect(() => copyB.registerBlockType('__cross_copy_duplicate__', stubFactory)).toThrow();
  });

  it('registerBuiltinBlocks ของ copy ที่สอง = no-op ไม่ throw ชื่อ built-in ซ้ำ', async () => {
    vi.resetModules();
    const first = await import('../../src/blocks/register-builtin-blocks');
    first.registerBuiltinBlocks();

    vi.resetModules();
    const second = await import('../../src/blocks/register-builtin-blocks');

    // copy ที่สองมี "registered" flag ของตัวเองเป็น false — guard ต้องอ่าน registry ที่แชร์กัน
    expect(() => second.registerBuiltinBlocks()).not.toThrow();
  });
});

/**
 * ยิงกับ dist จริงใน child process (globalThis สะอาด ไม่ปนกับ src ที่เทสต์อื่น import ไว้แล้ว) —
 * ข้ามเมื่อยังไม่ได้ build ในเครื่อง; CI รัน `npm run build` ก่อน `npm test` เทสต์ชุดนี้จึงทำงานเสมอ
 */
const distBuilt = existsSync(join(DIST, 'index.cjs')) && existsSync(join(DIST, 'advanced.js'));

/** ลงทะเบียน block ผ่าน entry `advanced` แล้ว render ผ่าน entry หลัก — พังทันทีถ้า registry ไม่แชร์กัน */
function crossEntryProbe(loadMain: string, loadAdvanced: string): string {
  return `
    const main = ${loadMain};
    const adv = ${loadAdvanced};
    adv.registerBlockType('__cross_entry_probe__', () => ({
      measureHeight: () => 1,
      render: (ctx) => ctx.advanceY(1),
    }));
    main.createKapomReport({ blocks: [{ type: '__cross_entry_probe__' }] });
    console.log('ok');
  `;
}

function runNode(args: readonly string[]): string {
  try {
    return execFileSync(process.execPath, [...args], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };

    // ให้ข้อความ error จริงจาก child ขึ้นมาใน assertion แทน "Command failed" เปล่าๆ
    return `child failed: ${stderr.trim() || stdout.trim() || String(error)}`;
  }
}

describe.skipIf(!distBuilt)('block-registry — dist จริง: plugin ข้าม entry point', () => {
  it('CJS: registerBlockType จาก kapom-report/advanced ใช้ได้กับ createKapomReport จาก entry หลัก', () => {
    const script = crossEntryProbe(
      `require(${JSON.stringify(join(DIST, 'index.cjs'))})`,
      `require(${JSON.stringify(join(DIST, 'advanced.cjs'))})`,
    );

    expect(runNode(['-e', script])).toBe('ok');
  });

  it('ESM: เหมือนกัน (เคยผ่านอยู่แล้วเพราะ chunk แชร์ — กันไม่ให้หลุดภายหลัง)', () => {
    const script = crossEntryProbe(
      `await import(${JSON.stringify(pathToFileURL(join(DIST, 'index.js')).href)})`,
      `await import(${JSON.stringify(pathToFileURL(join(DIST, 'advanced.js')).href)})`,
    );

    expect(runNode(['--input-type=module', '-e', script])).toBe('ok');
  });
});
