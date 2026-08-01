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
    // bug-repros/ = ที่ทดลองในเครื่อง (gitignore ไว้) อยู่นอก tsconfig `include` จึงไม่มี type program ให้ type-aware rules ใช้
    ignores: ['dist/**', 'coverage/**', 'examples/output/**', 'docs/**', 'bug-repros/**'],
  },
  js.configs.recommended,
  // type-aware: กฎที่ต้องรู้ type จริงถึงจะตรวจได้ (no-floating-promises, no-unsafe-*, no-base-to-string,
  // switch-exhaustiveness-check) — จับของที่ syntax-only มองไม่เห็น เช่น `String(obj)` ที่ออกมาเป็น
  // "[object Object]" บน PDF; แลกกับ lint ช้าขึ้น ~2 เท่า (5s → 10s) เพราะต้องสร้าง type program
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'examples/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-restricted-syntax': ['error', NO_RAW_DOC_TEXT],
      // switch บน union ต้องครบทุก case — แทนการเขียน `const exhaustive: never` เองทุกที่
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
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
        // เว้นก่อน return/throw เพื่อแยก "ทางออกของฟังก์ชัน" ออกจากงานที่ทำมาก่อนหน้า — ตัวที่เป็น
        // statement แรกของ block ไม่โดน เพราะกฎทำงานระหว่างสอง statement เท่านั้น (ไม่มีตัวก่อนหน้า
        // = ไม่บังคับ) ซึ่งครอบคลุม guard ส่วนใหญ่ที่เขียน `if (...) { throw ... }` อยู่แล้ว
        { blankLine: 'always', prev: '*', next: ['return', 'throw'] },
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
  {
    // config/script ที่อยู่นอก tsconfig `include` — ไม่มี type program ให้ตรวจ
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
