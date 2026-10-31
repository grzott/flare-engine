import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..', '..');
const policy: { heldGlobs: string[] } = JSON.parse(
  readFileSync(join(root, '.github', 'risk-policy.json'), 'utf8'),
);
const rules = readFileSync(join(root, '.github', 'CODEOWNERS'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));

// Bun.Glob matches a bare name (`README.md`) at the repo root only; CODEOWNERS matches it at
// any depth. Anchoring with a leading `/` gives CODEOWNERS the classifier's meaning.
const asCodeowners = (glob: string) => (glob.includes('/') ? glob : `/${glob}`);

describe('CODEOWNERS', () => {
  it('routes exactly the held globs of risk-policy.json, in order, with root-only names anchored', () => {
    expect(rules.map(([pattern]) => pattern)).toEqual(policy.heldGlobs.map(asCodeowners));
  });

  it('assigns every held glob to the owner and nobody else', () => {
    for (const [, ...owners] of rules) expect(owners).toEqual(['@grzott']);
  });
});
