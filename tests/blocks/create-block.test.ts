import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { TextBlock } from '../../src/blocks/text-block';
import { SpacerBlock } from '../../src/blocks/spacer-block';
import { DividerBlock } from '../../src/blocks/divider-block';
import { KapomError } from '../../src/core/errors';

describe('createBlock', () => {
  it('text node → TextBlock', () => {
    expect(createBlock({ type: 'text', content: 'x' })).toBeInstanceOf(TextBlock);
  });

  it('spacer node → SpacerBlock', () => {
    expect(createBlock({ type: 'spacer', height: 5 })).toBeInstanceOf(SpacerBlock);
  });

  it('divider node → DividerBlock', () => {
    expect(createBlock({ type: 'divider' })).toBeInstanceOf(DividerBlock);
  });

  it('node type ที่ยังไม่รองรับ (เช่น image) → throw KapomError', () => {
    expect(() =>
      createBlock({
        type: 'image',
        data: '',
        format: 'PNG',
        width: 1,
        height: 1,
      }),
    ).toThrow(KapomError);
  });
});
