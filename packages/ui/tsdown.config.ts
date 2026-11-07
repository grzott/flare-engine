import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/focus.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  fixedExtension: false,
});
