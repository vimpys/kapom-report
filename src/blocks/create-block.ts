import { registerBuiltinBlocks } from './register-builtin-blocks';

// เรียกฟังก์ชันตรงๆ ไม่ใช่ bare side-effect import — bundler ที่เชื่อ `sideEffects: false`
// ตัด bare import ทิ้งได้ แต่ตัด call ใน module ที่ export ถูกใช้งานจริงไม่ได้ (ดู register-builtin-blocks.ts)
registerBuiltinBlocks();

export { createBlock } from './block-registry';
