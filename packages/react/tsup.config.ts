import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@flare-engine/render',
    '@flare-engine/input',
    'react',
    'react-native',
    '@shopify/react-native-skia',
    'react-native-gesture-handler',
    'react-native-safe-area-context',
  ],
});
