import { describe, expect, it } from 'bun:test';
import { classifyLine, isDetectorSource, isSensitivePath, redact } from '../scan-history.mjs';

// Fixtures are assembled at runtime so this file never contains a contiguous
// token-shaped string itself — the scanner would otherwise flag its own test.
const fakeNpmToken = `npm_${'A1b2C3d4E5'.repeat(3)}abcdef`;
const fakeGhToken = `ghp_${'Zz9Yy8Xx7W'.repeat(3)}abcdef`;

describe('classifyLine', () => {
  it('reports an npm token as a secret and redacts it', () => {
    const { secrets } = classifyLine(`//registry.npmjs.org/:_authToken=${fakeNpmToken}`);
    const categories = secrets.map((s) => s.category).sort();
    expect(categories).toEqual(['auth-token-literal', 'npm-token']);
    for (const s of secrets) expect(s.value).not.toContain(fakeNpmToken.slice(4, 20));
  });

  it('reports a GitHub token as a secret', () => {
    expect(classifyLine(`token: ${fakeGhToken}`).secrets.map((s) => s.category)).toEqual([
      'gh-token',
    ]);
  });

  it('treats an env-var reference as exposure, not a secret', () => {
    const envRef = ['$', '{NPM_TOKEN}'].join('');
    const r = classifyLine(`//registry.npmjs.org/:_authToken=${envRef}`);
    expect(r.secrets).toEqual([]);
    expect(r.exposure).toContain('auth-token-ref');
  });

  it('treats a placeholder CI value as exposure, not a secret', () => {
    const r = classifyLine('TESTINGBOT_KEY=your-key-here');
    expect(r.secrets).toEqual([]);
    expect(r.exposure).toContain('ci-secret');
  });

  it('flags a literal CI secret assignment', () => {
    const r = classifyLine(`TESTINGBOT_SECRET=${'q7Rk2mWp9Lx4'.repeat(2)}`);
    expect(r.secrets.map((s) => s.category)).toEqual(['ci-secret-literal']);
  });

  it('inventories game vocabulary without calling it a secret', () => {
    const r = classifyLine('// Pan Tvardowski boss banter');
    expect(r.secrets).toEqual([]);
    expect(r.exposure).toEqual(['pt-vocab']);
  });

  it('returns nothing for an ordinary line', () => {
    expect(classifyLine('export const add = (a: number, b: number) => a + b;')).toEqual({
      secrets: [],
      exposure: [],
    });
  });
});

describe('isSensitivePath', () => {
  it('matches .npmrc and real .env files at any depth', () => {
    expect(isSensitivePath('.npmrc')).toBe(true);
    expect(isSensitivePath('apps/game/.npmrc')).toBe(true);
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('apps/game/.env.local')).toBe(true);
  });

  it('ignores example and template env files', () => {
    expect(isSensitivePath('apps/bench-web/.env.testingbot.example')).toBe(false);
    expect(isSensitivePath('.env.example')).toBe(false);
    expect(isSensitivePath('.env.template')).toBe(false);
  });

  it('does not match look-alikes', () => {
    expect(isSensitivePath('docs/npmrc-notes.md')).toBe(false);
    expect(isSensitivePath('src/environment.ts')).toBe(false);
  });
});

describe('isDetectorSource', () => {
  it('recognises the detectors and their tests, nothing else', () => {
    expect(isDetectorSource('scripts/audit-tarballs.mjs')).toBe(true);
    expect(isDetectorSource('scripts/lib/leak-patterns.mjs')).toBe(true);
    expect(isDetectorSource('scripts/tests/scan-history.test.ts')).toBe(true);
    expect(isDetectorSource('scripts/check-perf.mjs')).toBe(false);
    expect(isDetectorSource('packages/core/src/index.ts')).toBe(false);
    expect(isDetectorSource('apps/x/scripts/audit-tarballs.mjs')).toBe(false);
  });
});

describe('redact', () => {
  it('keeps four characters and the length', () => {
    expect(redact('abcdefghij')).toBe('abcd…[10 chars]');
  });
});
