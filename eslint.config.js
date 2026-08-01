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
    ignores: ['dist/**', 'coverage/**', 'examples/output/**', 'docs/**'],
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
      // style — เว้นบรรทัดให้โค้ดอ่านเป็นหน่วย; auto-fix ได้ด้วย `npx eslint . --fix`
      // NOTE: กฎ formatting ย้ายไป @stylistic/eslint-plugin ตั้งแต่ ESLint 9 — ตัวนี้ยังอยู่ใน core
      // ของ v10 ถ้า upgrade แล้วหาย ให้ลง @stylistic แล้วใช้ชื่อ '@stylistic/padding-line-between-statements'
      'padding-line-between-statements': [
        'error',
        // ปิด block (`}`) แล้วมีโค้ดต่อ → เว้น 1 บรรทัด ให้แต่ละ guard/branch เป็นหน่วยที่แยกกันด้วยตา
        // (เห็นผลชัดสุดใน validation ที่เขียน if ต่อกันรัวๆ)
        { blankLine: 'always', prev: 'block-like', next: '*' },
        // เว้นก่อน return เพื่อแยก "ผลลัพธ์" ออกจากงานที่ทำมาก่อนหน้า — return ที่เป็น statement แรก
        // ของ block ไม่โดน เพราะกฎทำงานระหว่างสอง statement เท่านั้น (ไม่มีตัวก่อนหน้า = ไม่บังคับ)
        { blankLine: 'always', prev: '*', next: 'return' },
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
