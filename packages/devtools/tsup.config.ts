import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    'react',
    'react-native',
    '@flare-engine/core',
    '@flare-engine/ecs',
    '@flare-engine/events',
  ],
});
