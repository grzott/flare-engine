/**
 * #501: the published `.d.mts` is emitted from `src/`, and a web consumer has no
 * react-native-skia installed, so one `import type` from it in `src/` breaks
 * their build with TS2307. No typecheck in this repo can see that: `skipLibCheck`
 * is on and the package is installed. This scan is what holds it.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const NATIVE_SKIA = '@shopify/react-native-skia';
const SRC = join(import.meta.dir, '..', 'src');
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function specifiersIn(code: string): string[] {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return [...clean.matchAll(SPECIFIER)].map((m) => m[1] as string);
}

const isNativeSkia = (s: string): boolean => s === NATIVE_SKIA || s.startsWith(`${NATIVE_SKIA}/`);

const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(SRC, f));

describe('the published types need no react-native-skia (#501)', () => {
  test('the scan sees every import form a declaration file can carry', () => {
    const code = [
      `import type { SkCanvas } from '${NATIVE_SKIA}';`,
      `export type { SkPaint } from "${NATIVE_SKIA}/lib/module";`,
      `type Api = typeof import('${NATIVE_SKIA}');`,
      `// import type { SkPath } from '${NATIVE_SKIA}';`,
      `/* import type { SkRect } from '${NATIVE_SKIA}'; */`,
    ].join('\n');
    expect(specifiersIn(code)).toEqual([NATIVE_SKIA, `${NATIVE_SKIA}/lib/module`, NATIVE_SKIA]);
  });

  test('the scan reads the source files', () => {
    expect(files.map((f) => f.slice(SRC.length + 1).replaceAll('\\', '/'))).toContain('draw.ts');
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  test('no source file imports react-native-skia', () => {
    const hits = files.flatMap((f) =>
      specifiersIn(readFileSync(f, 'utf8'))
        .filter(isNativeSkia)
        .map((s) => `${f}: ${s}`),
    );
    expect(hits).toEqual([]);
  });
});
