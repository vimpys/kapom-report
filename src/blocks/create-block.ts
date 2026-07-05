import './register-builtin-blocks'; // side-effect: ลงทะเบียน built-in blocks ก่อน createBlock ถูกเรียกครั้งแรก

export { createBlock } from './block-registry';
