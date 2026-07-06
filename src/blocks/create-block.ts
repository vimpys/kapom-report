import { registerBuiltinBlocks } from './register-builtin-blocks';

// Calls the function directly rather than a bare side-effect import — a bundler that trusts
// `sideEffects: false` can drop a bare import, but it can't drop a call inside a module whose
// exports are actually used (see register-builtin-blocks.ts)
registerBuiltinBlocks();

export { createBlock } from './block-registry';
