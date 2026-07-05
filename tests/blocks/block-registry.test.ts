import { describe, expect, it } from 'vitest';
import { createBlock, registerBlockType } from '../../src/blocks/block-registry';
import '../../src/blocks/register-builtin-blocks'; // ensure built-ins registered เหมือน create-block.ts จริง
import { KapomError } from '../../src/core/errors';
import type { MeasurableBlock } from '../../src/core/context';
import { TextBlock } from '../../src/blocks/text-block';

describe('block-registry — built-in types ผ่าน registry จริง', () => {
  it('createBlock dispatch built-in ผ่าน registry ได้ (ไม่ใช่ switch แล้ว)', () => {
    expect(createBlock({ type: 'text', content: 'x' })).toBeInstanceOf(TextBlock);
  });

  it('type ที่ไม่เคยลงทะเบียน → throw KapomError', () => {
    expect(() => createBlock({ type: 'not-a-real-type' } as never)).toThrow(KapomError);
  });
});

describe('block-registry — registerBlockType (plugin API)', () => {
  it('เพิ่ม type ใหม่ได้โดยไม่แก้ core — createBlock dispatch ไปหา factory ที่ register ไว้', () => {
    const stub: MeasurableBlock = { measureHeight: () => 42, render: () => {} };
    registerBlockType('__test_custom_block__', () => stub);

    const block = createBlock({ type: '__test_custom_block__' } as never);

    expect(block).toBe(stub);
    expect(block.measureHeight({} as never)).toBe(42);
  });

  it('register ชื่อซ้ำ → throw ทันที ไม่ silent overwrite', () => {
    registerBlockType('__test_duplicate_guard__', () => ({
      measureHeight: () => 0,
      render: () => {},
    }));

    expect(() =>
      registerBlockType('__test_duplicate_guard__', () => ({
        measureHeight: () => 1,
        render: () => {},
      })),
    ).toThrow(KapomError);
  });

  it('register ชื่อชนกับ built-in (text) → throw เหมือนกัน', () => {
    expect(() => registerBlockType('text', () => ({ measureHeight: () => 0, render: () => {} }))).toThrow(
      KapomError,
    );
  });
});
