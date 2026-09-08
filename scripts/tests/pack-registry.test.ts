import { describe, expect, it } from 'bun:test';
import type { RegistryCheck } from '../lib/pack.mjs';
import { checkRegistry, NPMJS_REGISTRY } from '../lib/pack.mjs';

// F3-ASSERT: audit-tarballs.mjs must abort the published-version fetch unless
// npm resolves to the real registry — a leftover verdaccio override would
// otherwise get scanned and reported as published (XR-11).

// Narrows `RegistryCheck` to the abort branch, failing the test with a clear
// message rather than a TS2339 if the registry was unexpectedly accepted.
const expectAbort = (result: RegistryCheck): string => {
  if (result.ok) throw new Error('expected checkRegistry to abort, but it returned ok: true');
  return result.message;
};

describe('checkRegistry — the F3-ASSERT gate', () => {
  it('accepts the real registry', () => {
    expect(checkRegistry(NPMJS_REGISTRY)).toEqual({ ok: true });
  });

  it('accepts the real registry without a trailing slash', () => {
    expect(checkRegistry('https://registry.npmjs.org')).toEqual({ ok: true });
  });

  it('accepts npm config get output with a trailing newline', () => {
    expect(checkRegistry(`${NPMJS_REGISTRY}\n`)).toEqual({ ok: true });
  });

  it('rejects a verdaccio override and names it in the message', () => {
    const message = expectAbort(checkRegistry('http://localhost:4873/'));
    expect(message).toContain('http://localhost:4873/');
  });

  it('rejects an empty value and still produces a message', () => {
    const message = expectAbort(checkRegistry(''));
    expect(message).toContain('""');
  });

  it('points at the runbook pre-flight box', () => {
    const message = expectAbort(checkRegistry('http://localhost:4873/'));
    expect(message).toContain('flip-runbook.md');
  });
});
