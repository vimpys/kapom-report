import { describe, expect, it } from 'vitest';
import { createBlock } from '../../src/blocks/create-block';
import { TextBlock } from '../../src/blocks/text-block';
import { SpacerBlock } from '../../src/blocks/spacer-block';
import { DividerBlock } from '../../src/blocks/divider-block';
import { ImageBlock } from '../../src/blocks/image-block';
import { SignatureBlock } from '../../src/blocks/signature-block';
import { StackBlock } from '../../src/blocks/stack-block';
import { SectionBlock } from '../../src/blocks/section-block';
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

  it('image node → ImageBlock', () => {
    expect(
      createBlock({ type: 'image', data: '', format: 'PNG', width: 10, height: 10 }),
    ).toBeInstanceOf(ImageBlock);
  });

  it('signature node → SignatureBlock', () => {
    expect(
      createBlock({ type: 'signature', slots: [{ label: 'ผู้จัดทำ' }] }),
    ).toBeInstanceOf(SignatureBlock);
  });

  it('node type ที่ยังไม่รองรับ (เช่น raw) → throw KapomError', () => {
    expect(() =>
      createBlock({
        type: 'raw',
        measure: () => 0,
        draw: () => {
          /* no-op */
        },
      }),
    ).toThrow(KapomError);
  });

  it('stack node → StackBlock ที่มีลูกแปลงผ่าน createBlock แล้ว', () => {
    const block = createBlock({
      type: 'stack',
      children: [
        { type: 'spacer', height: 5 },
        { type: 'text', content: 'x' },
      ],
    });

    expect(block).toBeInstanceOf(StackBlock);
  });

  it('section node → SectionBlock ที่เก็บ name ไว้', () => {
    const block = createBlock({
      type: 'section',
      name: 'header',
      children: [{ type: 'text', content: 'x' }],
    });

    expect(block).toBeInstanceOf(SectionBlock);
    expect((block as SectionBlock).name).toBe('header');
  });
});
