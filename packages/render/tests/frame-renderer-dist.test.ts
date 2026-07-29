import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RENDER_DIR = join(__dirname, '..');
const DIST_CJS = join(RENDER_DIR, 'dist', 'index.js');
const DIST_ESM = join(RENDER_DIR, 'dist', 'index.mjs');

// turbo.json declares test.dependsOn: ["build"] and build.dependsOn: ["^build"],
// so under `bun run test` all dep builds complete before this suite starts.
// For a bare `bun test` run the first assertions below fail clearly if dist is
// absent; the fix is `bun run build` in packages/render.
//
// PERF-10 changed what this canary guards. The `fillXforms` counters used to
// read the bare `__DEV__` identifier, and the risk was tsdown constant-folding
// it (`typeof true`), which would freeze the flag at build time. They now read
// `globalThis.__DEV__` as a property, which is ~400x cheaper when the global is
// undeclared (B28). A `define`-style substitution cannot rewrite a member
// expression, so the folding risk is gone — but the *reason* the property form
// exists is that the identifier form is expensive, and nothing else in the repo
// would notice a well-meaning refactor putting it back. That is what these
// assertions now pin.
//
// Both artifacts are checked: the ESM one is what Metro and every web bundler
// actually load via the `import` condition, so a CJS-only grep would miss a
// per-format regression.
describe('frame-renderer dist: the dev-flag read stays a property access', () => {
  test('dist/index.js exists after build', () => {
    expect(existsSync(DIST_CJS)).toBe(true);
  });

  test('dist/index.mjs exists after build', () => {
    expect(existsSync(DIST_ESM)).toBe(true);
  });

  for (const [label, path] of [
    ['dist/index.js', DIST_CJS],
    ['dist/index.mjs', DIST_ESM],
  ] as const) {
    test(`${label} reads the flag as a globalThis property`, () => {
      const content = readFileSync(path, 'utf8');
      expect(content).toMatch(/__DEV__/);
      // The minifier may alias `globalThis` to a local; what must survive is a
      // member read of `.__DEV__` rather than a bare identifier reference.
      expect(content).toMatch(/\.__DEV__/);
    });

    test(`${label} never evaluates the bare __DEV__ identifier in the hot path`, () => {
      const content = readFileSync(path, 'utf8');
      // `typeof __DEV__` is the ~270 ns/eval form PERF-10 removed. Any
      // reintroduction — by a refactor or by a bundler transform — fails here.
      expect(content).not.toContain('typeof __DEV__');
    });

    test(`${label} was not constant-folded at build time`, () => {
      const content = readFileSync(path, 'utf8');
      // A `define` substitution would leave these artifacts behind and freeze
      // the flag, defeating the runtime togglability the counters require.
      expect(content).not.toContain('typeof true');
      expect(content).not.toContain('typeof false');
      expect(content).not.toContain('globalThis.true');
      expect(content).not.toContain('globalThis.false');
    });
  }
});
