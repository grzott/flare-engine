import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@flare/core', '@flare/ecs', '@flare/events', '@flare/math', '@flare/render'],
});
