import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractCandidates,
  findDistFile,
  findUnbuiltPackages,
  parseDeclaredNames,
  parseExportedNames,
  parseMemberNames,
  parseSymbolsOk,
  resolveCandidate,
} from '../check-changeset-symbols.mjs';

// A tiny, hand-built surface standing in for a real `dist/index.d.ts` parse —
// keeps these tests independent of the real repo's changing package shapes.
const EXPORT_SET = new Set(['QueryBuilder', 'Prefab', 'Query', 'Vec2']);
const MEMBER_SET = new Set(['spawn', 'entities', 'scaleToLengthInto']);

describe('extractCandidates — the extraction heuristic', () => {
  it('accepts a plain identifier and a dotted member path', () => {
    const found = extractCandidates('`QueryBuilder` wraps `Query.entities`.').map(
      (c) => c.candidate,
    );
    expect(found).toEqual(['QueryBuilder', 'Query.entities']);
  });

  it('strips a trailing generic before validating', () => {
    const found = extractCandidates('`SpatialEntry<T>` is no longer exported.').map(
      (c) => c.candidate,
    );
    expect(found).toEqual(['SpatialEntry']);
  });

  it('strips a call-form argument list before validating', () => {
    const found = extractCandidates('`Prefab.spawn(world)` drops the parameter.').map(
      (c) => c.candidate,
    );
    expect(found).toEqual(['Prefab.spawn']);
  });

  it('ignores a file path', () => {
    expect(extractCandidates('See `packages/ecs/src/query.ts` for the fix.')).toEqual([]);
    expect(extractCandidates('Read `AGENTS.md` first.')).toEqual([]);
    expect(extractCandidates('Bump `api-specs.md` too.')).toEqual([]);
  });

  it('ignores a shell command (contains whitespace)', () => {
    expect(extractCandidates('Run `bun run test` before committing.')).toEqual([]);
    expect(extractCandidates('Was `new QueryBuilder()`, now compiles differently.')).toEqual([]);
  });

  it('ignores a package name', () => {
    expect(extractCandidates('Depends on `@flare-engine/ecs` only.')).toEqual([]);
  });

  it('ignores a version, a flag, and a bare number', () => {
    expect(extractCandidates('Bumped to `0.4.0` behind `--registry`, was `1e-6`.')).toEqual([]);
  });

  it('ignores a bare lowercase word and TS primitive keywords', () => {
    const found = extractCandidates('The `shape` field is a `number`, not a `solid` flag.');
    expect(found).toEqual([]);
  });

  it('rejects a lowercase-headed dotted path (instance access, not a type reference)', () => {
    // `entitlementStore` is a local variable in the illustrating example, not
    // a symbol claim — see header comment rule 8. The call's own argument is
    // dropped with the rest of the parens, so the whole span yields nothing.
    expect(extractCandidates('`entitlementStore.grant(entitlementKey)` is now called.')).toEqual(
      [],
    );
  });

  it('still extracts a real member name when it is backticked on its own', () => {
    const found = extractCandidates(
      'the now-redundant `entitlementKey` prop is removed from `PaywallModalProps`',
    ).map((c) => c.candidate);
    expect(found).toEqual(['entitlementKey', 'PaywallModalProps']);
  });

  it('filters an ambient JS/TS builtin even though it is identifier-shaped', () => {
    expect(extractCandidates('Falls back to `Date.now()`, never leaks `NaN`.')).toEqual([]);
  });

  it('filters a known peer-framework API named for interop', () => {
    expect(extractCandidates('Uses `useSharedValue` and `runOnUI` from Reanimated.')).toEqual([]);
  });

  it('rejects a single-character generic-parameter mention', () => {
    expect(extractCandidates('pass `() => T` for per-entity state')).toEqual([]);
  });

  it('deduplicates repeated mentions of the same candidate within one file', () => {
    const found = extractCandidates('`QueryBuilder` ... later, `QueryBuilder` again.');
    expect(found.length).toBe(1);
  });
});

describe('resolveCandidate — resolution, including the removal union', () => {
  it('resolves a real bare export', () => {
    expect(resolveCandidate('QueryBuilder', false, EXPORT_SET, MEMBER_SET)).toBe(true);
  });

  it('fails a typo of a real export', () => {
    expect(resolveCandidate('QueryBuiIder', false, EXPORT_SET, MEMBER_SET)).toBe(false);
  });

  it('resolves a real dotted member path (head exported, tail a known member)', () => {
    expect(resolveCandidate('Prefab.spawn', true, EXPORT_SET, MEMBER_SET)).toBe(true);
  });

  it('fails a dotted path whose head is not exported', () => {
    expect(resolveCandidate('Ghost.spawn', true, EXPORT_SET, MEMBER_SET)).toBe(false);
  });

  it('fails a dotted path whose tail is not a known member', () => {
    expect(resolveCandidate('Prefab.teleport', true, EXPORT_SET, MEMBER_SET)).toBe(false);
  });

  it('a removed symbol resolves when the caller unions HEAD with the baseline surface', () => {
    // Mirrors what `main` does: `new Set([...head.exportSet, ...baseline.exportSet])`.
    // `ShopPanel` no longer exists at HEAD (removed) but existed at the last
    // release — the design's answer to "removals are not a failure".
    const headOnly = new Set(['QueryBuilder']);
    const baselineOnly = new Set(['ShopPanel']);
    const union = new Set([...headOnly, ...baselineOnly]);

    expect(resolveCandidate('ShopPanel', false, headOnly, MEMBER_SET)).toBe(false);
    expect(resolveCandidate('ShopPanel', false, union, MEMBER_SET)).toBe(true);
  });
});

describe('parseSymbolsOk — the escape hatch', () => {
  it('parses a single acknowledged name', () => {
    expect(parseSymbolsOk('body <!-- symbols-ok: FooBar --> more')).toEqual(new Set(['FooBar']));
  });

  it('parses a comma-separated list, trimmed', () => {
    expect(parseSymbolsOk('<!-- symbols-ok: FooBar, baz.qux -->')).toEqual(
      new Set(['FooBar', 'baz.qux']),
    );
  });

  it('an escaped candidate is treated as acknowledged, not resolved', () => {
    const text = '`GhostSymbol` is mentioned. <!-- symbols-ok: GhostSymbol -->';
    const escaped = parseSymbolsOk(text);
    const found = extractCandidates(text);
    expect(found.length).toBe(1);
    const { candidate } = found[0]!;
    expect(escaped.has(candidate)).toBe(true);
    expect(resolveCandidate(candidate, false, EXPORT_SET, MEMBER_SET)).toBe(false);
  });

  it('returns an empty set when there is no escape comment', () => {
    expect(parseSymbolsOk('nothing here').size).toBe(0);
  });
});

describe('parseExportedNames / parseMemberNames / parseDeclaredNames — dist and source parsing', () => {
  it('reads the bundler-emitted trailing export list, resolving `as` aliases', () => {
    const dist = 'export { type CircleShape as CircleShapeType, CollisionWorld, type Foo };';
    expect(parseExportedNames(dist)).toEqual(new Set(['CircleShapeType', 'CollisionWorld', 'Foo']));
  });

  it('reads indented interface/class members, including get/set accessors', () => {
    const dist = [
      'interface Prefab {',
      '  readonly name: string;',
      '  spawn(world: World): number;',
      '}',
      'declare class PostFxSurface {',
      '  get globalIntensity(): number;',
      '  set globalIntensity(value: number);',
      '}',
    ].join('\n');
    const members = parseMemberNames(dist);
    expect(members.has('name')).toBe(true);
    expect(members.has('spawn')).toBe(true);
    expect(members.has('globalIntensity')).toBe(true);
  });

  it('reads a bare signature parameter name from a single-line method', () => {
    const dist = '  pointerUp(x: number, y: number, elapsedSinceDown?: number): void;';
    expect(parseMemberNames(dist).has('elapsedSinceDown')).toBe(true);
  });

  it('declared names include a top-level declaration with no export keyword', () => {
    // Mirrors `_WorldQueryBuilder` in this repo's real history: real code,
    // never exported. See header comment's DECLARED_NAME_RE rationale.
    const source = 'class _WorldQueryBuilder extends QueryBuilder {\n  x = 1;\n}';
    expect(parseDeclaredNames(source).has('_WorldQueryBuilder')).toBe(true);
    expect(parseExportedNames(source).has('_WorldQueryBuilder')).toBe(false);
  });

  it('declared names also pick up a multi-line barrel re-export', () => {
    const source = [
      'export {',
      '  resetKeyboardFrame,',
      '  createKeyboard,',
      "} from './keyboard.js';",
    ].join('\n');
    const names = parseDeclaredNames(source);
    expect(names.has('resetKeyboardFrame')).toBe(true);
    expect(names.has('createKeyboard')).toBe(true);
  });
});

describe('findDistFile / findUnbuiltPackages — fail loudly on missing input', () => {
  let scratch: string;

  afterEach(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  });

  it('reports a package with no dist/ as unbuilt', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sym-gate-'));
    const pkgDir = join(scratch, 'no-dist-pkg');
    mkdirSync(pkgDir, { recursive: true });

    expect(findDistFile(pkgDir)).toBeNull();
    expect(findUnbuiltPackages([{ name: '@flare-engine/no-dist-pkg', dir: pkgDir }])).toEqual([
      { name: '@flare-engine/no-dist-pkg', dir: pkgDir },
    ]);
  });

  it('a package with dist/index.d.ts is not reported as unbuilt', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sym-gate-'));
    const pkgDir = join(scratch, 'built-pkg');
    mkdirSync(join(pkgDir, 'dist'), { recursive: true });
    writeFileSync(join(pkgDir, 'dist', 'index.d.ts'), 'export {};\n');

    expect(findDistFile(pkgDir)).toBe(join(pkgDir, 'dist', 'index.d.ts'));
    expect(findUnbuiltPackages([{ name: '@flare-engine/built-pkg', dir: pkgDir }])).toEqual([]);
  });

  it('accepts the scaffolder-style `.d.mts` fallback', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sym-gate-'));
    const pkgDir = join(scratch, 'mts-pkg');
    mkdirSync(join(pkgDir, 'dist'), { recursive: true });
    writeFileSync(join(pkgDir, 'dist', 'index.d.mts'), 'export {};\n');

    expect(findDistFile(pkgDir)).toBe(join(pkgDir, 'dist', 'index.d.mts'));
  });

  it('a mixed batch reports only the unbuilt ones', () => {
    scratch = mkdtempSync(join(tmpdir(), 'sym-gate-'));
    const built = join(scratch, 'built');
    const unbuilt = join(scratch, 'unbuilt');
    mkdirSync(join(built, 'dist'), { recursive: true });
    writeFileSync(join(built, 'dist', 'index.d.ts'), 'export {};\n');
    mkdirSync(unbuilt, { recursive: true });

    const result = findUnbuiltPackages([
      { name: '@flare-engine/built', dir: built },
      { name: '@flare-engine/unbuilt', dir: unbuilt },
    ]);
    expect(result).toEqual([{ name: '@flare-engine/unbuilt', dir: unbuilt }]);
  });
});
