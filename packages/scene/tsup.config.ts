import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@flare-engine/core',
    '@flare-engine/ecs',
    '@flare-engine/events',
    '@flare-engine/math',
    '@flare-engine/render',
  ],
});
