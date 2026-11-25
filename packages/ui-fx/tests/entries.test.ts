import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { installReanimatedMock } from './support/mock-reanimated';
import { installRnMock } from './support/mock-rn';

// `.` imports `react-native` and Reanimated, which bun cannot load.
installRnMock();
installReanimatedMock();

const SRC = join(import.meta.dir, '..', 'src');

const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

const specifiersOf = (file: string): string[] => {
  const found: string[] = [];
  for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_SPECIFIER)) {
    found.push(match[1]!);
  }
  return found;
};

const resolveRelative = (from: string, specifier: string): string => {
  const base = join(dirname(from), specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    base,
  ];
  const hit = candidates.find((path) => existsSync(path) && statSync(path).isFile());
  if (hit === undefined) throw new Error(`${from} imports "${specifier}", which does not resolve`);
  return hit;
};

const sourceFilesUnder = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFilesUnder(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
};

/** Every bare specifier reachable from `roots` through relative imports. */
const bareImportsOf = (roots: readonly string[]): string[] => {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of specifiersOf(file)) {
      if (specifier.startsWith('.')) queue.push(resolveRelative(file, specifier));
      else bare.add(specifier);
    }
  }
  return [...bare].sort();
};

const isPackage = (specifier: string, name: string): boolean =>
  specifier === name || specifier.startsWith(`${name}/`);

const SKIA = '@shopify/react-native-skia';

describe('entries report which one they are', () => {
  test('. is the RN and react-native-web entry', async () => {
    expect((await import('../src/index')).UI_FX_ENTRY).toBe('rn');
  });

  test('. exports the provider, the factory, the wrappers and the hook', async () => {
    expect(Object.keys(await import('../src/index')).sort()).toEqual([
      'FlareButton',
      'FlareImage',
      'FlarePressable',
      'FlareProvider',
      'FlareText',
      'FlareView',
      'UI_FX_ENTRY',
      'createFlareComponent',
      'useFlareFx',
    ]);
  });

  test('./core is the headless entry', async () => {
    expect((await import('../src/core')).UI_FX_ENTRY).toBe('core');
  });

  test('./dom is the React DOM entry', async () => {
    expect((await import('../src/dom')).UI_FX_ENTRY).toBe('dom');
  });

  test('./dom exports the provider, the factory, the wrappers and the hook', async () => {
    expect(Object.keys(await import('../src/dom')).sort()).toEqual([
      'FlareButton',
      'FlareDiv',
      'FlareImg',
      'FlareLi',
      'FlareProvider',
      'FlareSpan',
      'UI_FX_ENTRY',
      'createFlareComponent',
      'useFlareFx',
    ]);
  });

  test('./fx resolves to a native and a web file', async () => {
    expect((await import('../src/fx.native')).UI_FX_ENTRY).toBe('fx-native');
    expect((await import('../src/fx.web')).UI_FX_ENTRY).toBe('fx-web');
  });
});

describe('module-graph boundaries', () => {
  test('./core reaches @flare-engine/math and nothing else', () => {
    const roots = [join(SRC, 'core.ts'), ...sourceFilesUnder(join(SRC, 'core'))];
    const outside = bareImportsOf(roots).filter(
      (specifier) => !isPackage(specifier, '@flare-engine/math'),
    );
    expect(outside).toEqual([]);
  });

  test('./dom never reaches react-native, Reanimated or Skia', () => {
    const forbidden = bareImportsOf([join(SRC, 'dom.ts')]).filter(
      (specifier) =>
        isPackage(specifier, 'react-native') ||
        isPackage(specifier, 'react-native-reanimated') ||
        isPackage(specifier, SKIA),
    );
    expect(forbidden).toEqual([]);
  });

  test('. never reaches Skia', () => {
    const forbidden = bareImportsOf([join(SRC, 'index.ts')]).filter((specifier) =>
      isPackage(specifier, SKIA),
    );
    expect(forbidden).toEqual([]);
  });
});

describe('the walker itself', () => {
  test('sees static, side-effect, dynamic and re-export specifiers', () => {
    const sample = [
      "import { a } from 'pkg-a';",
      "import type { B } from 'pkg-b';",
      "import 'pkg-c';",
      "export { d } from 'pkg-d';",
      "const e = await import('pkg-e');",
      "const f = require('pkg-f');",
    ].join('\n');
    const found = [...sample.matchAll(IMPORT_SPECIFIER)].map((match) => match[1]);
    expect(found).toEqual(['pkg-a', 'pkg-b', 'pkg-c', 'pkg-d', 'pkg-e', 'pkg-f']);
  });
});
