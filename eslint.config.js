// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const NO_RAW_DOC_TEXT = {
  selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='text'][callee.object.name='doc']",
  message:
    "ห้ามเรียก doc.text() ตรง — ต้องผ่าน drawText() จาก core/draw-text.ts เพื่อบังคับ normalizeText() ก่อนถึง jsPDF เสมอ (decision: text normalizer)",
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'examples/output/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'examples/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', NO_RAW_DOC_TEXT],
      '@typescript-eslint/no-unused-vars': [
        'error',
        // ตาม tsconfig noUnusedParameters: _prefix = ตั้งใจไม่ใช้ (contract ต้องรับ param แต่ implementation ไม่ต้องใช้)
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // จุดเดียวที่อนุญาต — facade เองต้องเรียก doc.text() ตรง
    files: ['src/core/draw-text.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // ตัวไฟล์นี้เจตนา match control chars เพื่อ strip ทิ้ง — คือ feature ไม่ใช่บั๊ก
    files: ['src/core/text-normalizer.ts'],
    rules: {
      'no-control-regex': 'off',
    },
  },
);
