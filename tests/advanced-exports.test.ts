/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import * as advanced from '../src/advanced';
import * as publicApi from '../src/index';

/**
 * The entry points are hand-written barrels, so anything added under src/ is exported only if
 * someone remembers to. Four composite block classes (Box/Row/KeyValue/BottomAnchor) sat
 * unexported for exactly that reason while every sibling class was listed, which left the
 * documented "author your own block" path unusable for anyone composing children.
 *
 * The first test derives its expectation from the filesystem instead of a hand-kept list, so a
 * new block class is covered the moment it exists.
 */

/** every block class defined under src/blocks — eager glob so this is a plain synchronous map */
const blockModules: Record<string, Record<string, unknown>> = import.meta.glob('../src/blocks/*-block.ts', {
  eager: true,
});

function definedBlockClasses(): string[] {
  const names = new Set<string>();
  for (const module of Object.values(blockModules)) {
    for (const [name, value] of Object.entries(module)) {
      // classes only: `createBlock` is a function whose name also ends in "Block", hence the capital check
      if (typeof value === 'function' && /^[A-Z]/.test(name) && name.endsWith('Block')) {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}

describe('kapom-report/advanced — export surface', () => {
  it('ทุก block class ที่มีอยู่ใน src/blocks ต้อง export ออก /advanced (ไม่ตกหล่นเงียบๆ)', () => {
    const defined = definedBlockClasses();
    const missing = defined.filter((name) => !(name in advanced));

    // ยืนยันว่า glob เจอไฟล์จริง — ไม่งั้นเทสต์ผ่านเพราะ list ว่าง
    expect(defined.length).toBeGreaterThanOrEqual(14);
    expect(missing).toEqual([]);
  });

  it('helper ที่ custom block ต้องใช้จริงถูก export (render() ได้มาแค่ RenderContext)', () => {
    // deriveMeasureContext คือทางเดียวที่จะวัดลูกจาก render(); อีก 2 ตัวคือสิ่งที่ container built-in ใช้
    for (const name of ['deriveMeasureContext', 'measureBlocksHeight', 'buildConfinedContext']) {
      expect(advanced, name).toHaveProperty(name);
      expect(typeof (advanced as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('คู่ของ drawText สำหรับวาดข้อความเองใน block: applyTextStyle + text metrics', () => {
    for (const name of ['applyTextStyle', 'lineHeightOf', 'splitTextLines', 'measureTextBlockHeight']) {
      expect(typeof (advanced as Record<string, unknown>)[name]).toBe('function');
    }

    // drawText อยู่ฝั่ง public เพราะ raw block ใช้ — applyTextStyle เป็นของคู่กันแต่เคยตกไป
    expect(typeof publicApi.drawText).toBe('function');
  });

  it('ไม่มี export ตัวไหนเป็น undefined (จับ barrel ที่อ้างชื่อผิด/ไฟล์ถูกย้าย)', () => {
    for (const [name, value] of Object.entries(advanced)) {
      expect(value, `advanced.${name}`).toBeDefined();
    }

    for (const [name, value] of Object.entries(publicApi)) {
      expect(value, `index.${name}`).toBeDefined();
    }
  });

  it('สอง entry ไม่ export ค่า runtime ชื่อซ้ำกันคนละตัว (ของเดียวกันต้องเป็น instance เดียว)', () => {
    for (const [name, value] of Object.entries(publicApi)) {
      const fromAdvanced = (advanced as Record<string, unknown>)[name];
      if (fromAdvanced !== undefined) expect(fromAdvanced, name).toBe(value);
    }
  });
});
