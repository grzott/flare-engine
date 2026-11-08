import { afterAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AllowlistEntry } from '../check-exported-types.mjs';
import { ALLOWLIST, analyzePackage, typesEntriesOf } from '../check-exported-types.mjs';

const ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-exported-types.mjs');
const ENTRY = '/pkg/dist/index.d.mts';

// Fixtures are tsdown-shaped: declarations without `export`, then one
// `export { … }` list at the bottom (or an `export declare …` inline).
const analyze = (
  files: Record<string, string>,
  opts: { entryPaths?: string[]; allowlist?: readonly AllowlistEntry[]; name?: string } = {},
) =>
  analyzePackage({
    name: opts.name ?? '@test/pkg',
    entryPaths: opts.entryPaths ?? [ENTRY],
    read: (path) => files[path],
    allowlist: opts.allowlist ?? [],
  });

describe('analyzePackage — direct references', () => {
  const body = [
    'interface Opts {',
    '  speed: number;',
    '}',
    'declare function make(o: Opts): void;',
  ];

  it('reports an exported function whose parameter type is an unexported interface', () => {
    const r = analyze({ [ENTRY]: [...body, 'export { make };', ''].join('\n') });
    expect(r.holes).toEqual([{ name: 'Opts', reachedFrom: ['make'] }]);
    expect(r.allowlisted).toEqual([]);
    expect(r.stale).toEqual([]);
  });

  it('passes once the interface is in the export list', () => {
    const r = analyze({ [ENTRY]: [...body, 'export { type Opts, make };', ''].join('\n') });
    expect(r.holes).toEqual([]);
  });

  it('treats `export declare …` inline exports as public', () => {
    const r = analyze({
      [ENTRY]: [
        'interface Opts {',
        '  speed: number;',
        '}',
        'export declare function make(o: Opts): void;',
        'export declare const DEFAULTS: Opts;',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([{ name: 'Opts', reachedFrom: ['DEFAULTS', 'make'] }]);
  });

  it('walks every overload signature', () => {
    const r = analyze({
      [ENTRY]: [
        'interface A {',
        '  a: number;',
        '}',
        'interface B {',
        '  b: number;',
        '}',
        'declare function f(x: A): void;',
        'declare function f(x: B): void;',
        'export { f };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([
      { name: 'A', reachedFrom: ['f'] },
      { name: 'B', reachedFrom: ['f'] },
    ]);
  });
});

describe('analyzePackage — types hidden inside hidden types', () => {
  const nested = [
    'interface Inner {',
    '  x: number;',
    '}',
    'interface Outer {',
    '  inner: Inner;',
    '}',
    'declare function f(o: Outer): void;',
  ];

  it('reports the outer type and, in the same run, what it reaches', () => {
    const r = analyze({ [ENTRY]: [...nested, 'export { f };', ''].join('\n') });
    expect(r.holes).toEqual([
      { name: 'Inner', reachedFrom: ['f via Outer'] },
      { name: 'Outer', reachedFrom: ['f'] },
    ]);
  });

  it('reports the inner type alone once the outer one is exported', () => {
    const r = analyze({ [ENTRY]: [...nested, 'export { type Outer, f };', ''].join('\n') });
    expect(r.holes).toEqual([{ name: 'Inner', reachedFrom: ['Outer'] }]);
  });

  it('names the whole path through several hidden types', () => {
    const r = analyze({
      [ENTRY]: [
        'interface C {',
        '  c: number;',
        '}',
        'interface B {',
        '  c: C;',
        '}',
        'interface A {',
        '  b: B;',
        '}',
        'declare function f(a: A): void;',
        'export { f };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([
      { name: 'A', reachedFrom: ['f'] },
      { name: 'B', reachedFrom: ['f via A'] },
      { name: 'C', reachedFrom: ['f via A > B'] },
    ]);
  });

  it('terminates on self- and mutually-recursive hidden types without reporting the cycle', () => {
    const r = analyze({
      [ENTRY]: [
        'interface Node {',
        '  next: Node | null;',
        '  peer: Peer;',
        '}',
        'interface Peer {',
        '  back: Node;',
        '}',
        'declare function head(): Node;',
        'export { head };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([
      { name: 'Node', reachedFrom: ['head'] },
      { name: 'Peer', reachedFrom: ['head via Node'] },
    ]);
  });

  it('does not walk into an allowlisted type', () => {
    const r = analyze(
      { [ENTRY]: [...nested, 'export { f };', ''].join('\n') },
      { allowlist: [{ pkg: '@test/pkg', name: 'Outer', reason: 'test' }] },
    );
    expect(r.holes).toEqual([]);
    expect(r.allowlisted).toEqual(['Outer']);
  });
});

describe('analyzePackage — export aliases', () => {
  it('counts `export { Local as Public }` as exported', () => {
    const r = analyze({
      [ENTRY]: [
        'interface Local {',
        '  v: number;',
        '}',
        'declare function f(l: Local): void;',
        'export { Local as Public, f };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([]);
  });

  it('names the hole by its local name and the reacher by its public name', () => {
    const r = analyze({
      [ENTRY]: [
        'interface Hidden$1 {',
        '  v: number;',
        '}',
        'interface Local {',
        '  h: Hidden$1;',
        '}',
        'export { Local as Public };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([{ name: 'Hidden$1', reachedFrom: ['Public'] }]);
  });
});

describe('analyzePackage — chunk files with one-letter export aliases', () => {
  const chunk = (exportList: string) =>
    [
      'interface Hidden {',
      '  h: number;',
      '}',
      'interface Opts {',
      '  h: Hidden;',
      '}',
      'declare function make(o: Opts): void;',
      `export { ${exportList} };`,
      '',
    ].join('\n');

  it('follows import aliases into the chunk and reports the hidden type once', () => {
    const r = analyze({
      [ENTRY]: [
        'import { a as Opts, b as make } from "./chunk-X.mjs";',
        'export { type Opts, make };',
        '',
      ].join('\n'),
      '/pkg/dist/chunk-X.d.mts': chunk('Opts as a, make as b'),
    });
    expect(r.holes).toEqual([{ name: 'Hidden', reachedFrom: ['Opts'] }]);
  });

  it('passes when the entry exports the hidden type through the chunk alias', () => {
    const r = analyze({
      [ENTRY]: [
        'import { a as Opts, b as make, c as Hidden } from "./chunk-X.mjs";',
        'export { type Hidden, type Opts, make };',
        '',
      ].join('\n'),
      '/pkg/dist/chunk-X.d.mts': chunk('Opts as a, make as b, Hidden as c'),
    });
    expect(r.holes).toEqual([]);
  });

  it("a chunk's own export list is not public by itself", () => {
    const r = analyze({
      [ENTRY]: ['import { b as make } from "./chunk-X.mjs";', 'export { make };', ''].join('\n'),
      '/pkg/dist/chunk-X.d.mts': chunk('Opts as a, make as b, Hidden as c'),
    });
    expect(r.holes).toEqual([
      { name: 'Hidden', reachedFrom: ['make via Opts'] },
      { name: 'Opts', reachedFrom: ['make'] },
    ]);
  });

  it('a second entry (subpath export) makes its exports public too', () => {
    const r = analyze(
      {
        [ENTRY]: ['import { b as make } from "./chunk-X.mjs";', 'export { make };', ''].join('\n'),
        '/pkg/dist/focus.d.mts': [
          'import { a as Opts, c as Hidden } from "./chunk-X.mjs";',
          'export { type Hidden, type Opts };',
          '',
        ].join('\n'),
        '/pkg/dist/chunk-X.d.mts': chunk('Opts as a, make as b, Hidden as c'),
      },
      { entryPaths: [ENTRY, '/pkg/dist/focus.d.mts'] },
    );
    expect(r.holes).toEqual([]);
  });

  it('throws a path-naming error when a chunk is missing', () => {
    expect(() =>
      analyze({
        [ENTRY]: ['import { b as make } from "./missing.mjs";', 'export { make };', ''].join('\n'),
      }),
    ).toThrow('/pkg/dist/missing.d.mts');
  });
});

describe('analyzePackage — what does not count', () => {
  it('ignores JSDoc prose, bare-package imports and shadowing type parameters', () => {
    const r = analyze({
      [ENTRY]: [
        'import { Foo } from "some-lib";',
        'import { Bar as Baz } from "@flare-engine/math";',
        'interface Hidden {',
        '  a: number;',
        '}',
        '/** See {@link Hidden} and Hidden. */',
        'declare function f(x: Foo, y: Baz): void;',
        'interface Box<Hidden> {',
        '  v: Hidden;',
        '}',
        'declare function g<Hidden>(h: Hidden): Hidden;',
        'type Unwrap<T> = T extends Promise<infer Hidden> ? Hidden : T;',
        'type Mapped<T> = { readonly [Hidden in keyof T]: T[Hidden] };',
        'export { type Box, type Mapped, type Unwrap, f, g };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([]);
  });

  it('ignores `export * from` and imports from bare packages', () => {
    const r = analyze({
      [ENTRY]: [
        'import { World } from "@flare-engine/ecs";',
        'export * from "@flare-engine/core";',
        'export { type World };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([]);
  });

  it('does not report a name that is referenced only from an unexported declaration', () => {
    const r = analyze({
      [ENTRY]: [
        'interface Unused {',
        '  u: number;',
        '}',
        'interface Dead {',
        '  u: Unused;',
        '}',
        'export declare function f(): void;',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([]);
  });
});

describe('analyzePackage — heritage clauses and typeof queries', () => {
  it('reports an unexported type argument on a class heritage clause', () => {
    const r = analyze({
      [ENTRY]: [
        'import { Component } from "react";',
        'interface Props {',
        '  a: number;',
        '}',
        'interface State {',
        '  b: number;',
        '}',
        'declare class C extends Component<Props, State> {',
        '  state: State;',
        '}',
        'export { C, type Props };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([{ name: 'State', reachedFrom: ['C'] }]);
  });

  it('reports a `typeof x` query on an unexported `declare const`', () => {
    const r = analyze({
      [ENTRY]: [
        'declare const table: {',
        '  readonly A: 0;',
        '  readonly B: 1;',
        '};',
        'type Id = (typeof table)[keyof typeof table];',
        'export { type Id };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([{ name: 'table', reachedFrom: ['Id'] }]);
  });

  it('passes a `typeof x` query on an exported `declare const`', () => {
    const r = analyze({
      [ENTRY]: [
        'declare const table: {',
        '  readonly A: 0;',
        '};',
        'type Id = (typeof table)[keyof typeof table];',
        'export { type Id, table };',
        '',
      ].join('\n'),
    });
    expect(r.holes).toEqual([]);
  });
});

describe('analyzePackage — allowlist', () => {
  const files = {
    [ENTRY]: [
      'interface Secret {',
      '  s: number;',
      '}',
      'declare function f(s: Secret): void;',
      'export { f };',
      '',
    ].join('\n'),
  };

  it('passes an allowlisted hole and reports it as allowlisted', () => {
    const r = analyze(files, {
      allowlist: [{ pkg: '@test/pkg', name: 'Secret', reason: 'test' }],
    });
    expect(r.holes).toEqual([]);
    expect(r.allowlisted).toEqual(['Secret']);
    expect(r.stale).toEqual([]);
  });

  it('fails an allowlist entry that is no longer reached', () => {
    const r = analyze(
      { [ENTRY]: 'export declare function f(): void;\n' },
      { allowlist: [{ pkg: '@test/pkg', name: 'Gone', reason: 'test' }] },
    );
    expect(r.holes).toEqual([]);
    expect(r.stale).toEqual(['Gone']);
  });

  it("only considers entries for this package's name", () => {
    const r = analyze(files, {
      allowlist: [{ pkg: '@test/other', name: 'Secret', reason: 'test' }],
    });
    expect(r.holes).toEqual([{ name: 'Secret', reachedFrom: ['f'] }]);
    expect(r.stale).toEqual([]);
  });

  it('ships exactly the three known deliberate holes', () => {
    expect(ALLOWLIST.map((e) => `${e.pkg} ${e.name}`)).toEqual([
      '@flare-engine/assets SkColorLike',
      '@flare-engine/errors ErrorBoundaryState',
      '@flare-engine/shapes SkiaApi',
    ]);
    for (const e of ALLOWLIST) expect(e.reason.length).toBeGreaterThan(10);
  });
});

describe('typesEntriesOf', () => {
  it('takes import.types from every subpath, skipping ./package.json', () => {
    const sub = (stem: string) => ({
      import: { types: `./dist/${stem}.d.mts`, default: `./dist/${stem}.mjs` },
      require: { types: `./dist/${stem}.d.ts`, default: `./dist/${stem}.js` },
    });
    expect(
      typesEntriesOf({
        exports: { '.': sub('index'), './focus': sub('focus'), './package.json': './package.json' },
      }),
    ).toEqual(['./dist/focus.d.mts', './dist/index.d.mts']);
  });

  it('falls back to a flat `types` condition, then to the manifest `types`', () => {
    expect(
      typesEntriesOf({ exports: { '.': { types: './dist/i.d.ts', default: './dist/i.js' } } }),
    ).toEqual(['./dist/i.d.ts']);
    expect(typesEntriesOf({ exports: './dist/i.mjs', types: './dist/i.d.ts' })).toEqual([
      './dist/i.d.ts',
    ]);
    expect(typesEntriesOf({})).toEqual([]);
  });
});

describe('CLI', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'check-exported-types-'));
  const pkgDir = join(scratch, 'hole-pkg');
  const distFile = join(pkgDir, 'dist', 'index.d.mts');
  const chunkFile = join(pkgDir, 'dist', 'chunk-Q.d.mts');

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  const run = (...args: string[]) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };

  const writePkg = (exportList: string) => {
    mkdirSync(join(pkgDir, 'dist'), { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@tmp/hole-pkg',
        exports: {
          '.': {
            import: { types: './dist/index.d.mts', default: './dist/index.mjs' },
            require: { types: './dist/index.d.ts', default: './dist/index.js' },
          },
        },
      }),
    );
    writeFileSync(
      distFile,
      [
        'import { a as make } from "./chunk-Q.mjs";',
        'interface Opts {',
        '  speed: number;',
        '}',
        'declare function configure(o: Opts): void;',
        `export { ${exportList} };`,
        '',
      ].join('\n'),
    );
    writeFileSync(chunkFile, 'declare function make(): void;\nexport { make as a };\n');
  };

  it('fails with the hole line, then passes once the type is exported', () => {
    writePkg('configure, make');
    const failed = run(pkgDir);
    expect(failed.code).toBe(1);
    expect(failed.out).toContain('@tmp/hole-pkg: Opts (reached from configure)');
    expect(failed.out).toContain('check-exported-types: FAILED — 1 hole(s)');

    writePkg('type Opts, configure, make');
    const passed = run(pkgDir);
    expect(passed.code).toBe(0);
    expect(passed.out).toContain(
      'check-exported-types: OK — 1 package(s), no declared-but-unexported type reachable from the public API (0 allowlisted).',
    );
  });

  it('tells the user to build when a types file is missing', () => {
    writePkg('type Opts, configure, make');
    rmSync(chunkFile);
    const r = run(pkgDir);
    expect(r.code).toBe(1);
    expect(r.out).toContain('@tmp/hole-pkg');
    expect(r.out).toContain('chunk-Q.d.mts');
    expect(r.out).toContain('run `bun run build` first');
  });

  it('fails a package directory without a package.json', () => {
    const empty = join(scratch, 'empty');
    mkdirSync(empty, { recursive: true });
    const r = run(empty);
    expect(r.code).toBe(1);
    expect(r.out).toContain('package.json');
  });
});
