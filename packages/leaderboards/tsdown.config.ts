import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  fixedExtension: false,
  // One output file per source module, so a bundler can drop `context` and its
  // `react` import when only a React-free export is used (tests/tree-shake.test.ts).
  unbundle: true,
});
