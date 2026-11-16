import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/core.ts', 'src/dom.ts', 'src/fx.native.ts', 'src/fx.web.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  fixedExtension: false,
});
