import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangedFile, ClassifyInput, RiskPolicy } from '../classify-pr-risk.mjs';
import { classifyPrRisk, isMajorBump } from '../classify-pr-risk.mjs';

const policy: RiskPolicy = JSON.parse(
  readFileSync(join(import.meta.dir, '..', '..', '.github', 'risk-policy.json'), 'utf8'),
);

function file(path: string, status: ChangedFile['status'], added: string[] = []): ChangedFile {
  return { path, status, added, removed: [] };
}

function input(overrides: Partial<ClassifyInput>): ClassifyInput {
  return {
    files: [],
    changesetLevels: [],
    depChanges: [],
    manifestFieldChanges: [],
    labels: [],
    author: 'flare-bot',
    ...overrides,
  };
}

describe('classifyPrRisk — manifests and agent rules', () => {
  it('holds a nested CLAUDE.md, which agents load as rules', () => {
    const verdict = classifyPrRisk(input({ files: [file('packages/x/CLAUDE.md', 'A')] }), policy);
    expect(verdict.reasons).toContain('held path packages/x/CLAUDE.md');
  });

  it('holds any package manifest change by the agent bot', () => {
    const verdict = classifyPrRisk(
      input({ files: [file('packages/cli/package.json', 'M')] }),
      policy,
    );
    expect(verdict.reasons).toContain('manifest change packages/cli/package.json');
  });

  it('holds a lockfile change by the agent bot', () => {
    const verdict = classifyPrRisk(input({ files: [file('bun.lock', 'M')] }), policy);
    expect(verdict.reasons).toContain('manifest change bun.lock');
  });

  it('lets a dependabot minor bump through', () => {
    const verdict = classifyPrRisk(
      input({
        author: 'dependabot[bot]',
        files: [file('package.json', 'M'), file('bun.lock', 'M')],
        depChanges: [{ manifest: 'package.json', name: 'turbo', from: '^2.9.6', to: '^2.11.10' }],
      }),
      policy,
    );
    expect(verdict).toEqual({ risk: 'auto', reasons: [] });
  });

  it('holds a dependency that dependabot adds', () => {
    const verdict = classifyPrRisk(
      input({
        author: 'dependabot[bot]',
        depChanges: [{ manifest: 'package.json', name: 'left-pad', from: null, to: '^1.3.0' }],
      }),
      policy,
    );
    expect(verdict.reasons).toContain('adds dependency left-pad');
  });

  it('holds a non-dependency manifest field change even from dependabot', () => {
    const verdict = classifyPrRisk(
      input({ author: 'dependabot[bot]', manifestFieldChanges: ['packages/cli/package.json'] }),
      policy,
    );
    expect(verdict.reasons).toContain('manifest fields changed in packages/cli/package.json');
  });
});

describe('classifyPrRisk', () => {
  it('auto for a src fix with no export line', () => {
    const verdict = classifyPrRisk(
      input({ files: [file('packages/math/src/vec2.ts', 'M', ['  return a * t;'])] }),
      policy,
    );
    expect(verdict).toEqual({ risk: 'auto', reasons: [] });
  });

  it('held when a file is deleted', () => {
    const verdict = classifyPrRisk(input({ files: [file('packages/x/src/a.ts', 'D')] }), policy);
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons).toContain('deletes packages/x/src/a.ts');
  });

  it('held when a rename removes a path', () => {
    const verdict = classifyPrRisk(input({ files: [file('packages/x/src/a.ts', 'R')] }), policy);
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons).toContain('renames packages/x/src/a.ts');
  });

  it('held for a held path', () => {
    const verdict = classifyPrRisk(
      input({ files: [file('.claude/hooks/pre-bash-guard.sh', 'M')] }),
      policy,
    );
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons).toContain('held path .claude/hooks/pre-bash-guard.sh');
  });

  it('held when an export line changes in package src', () => {
    const verdict = classifyPrRisk(
      input({
        files: [
          file('packages/math/src/vec2.ts', 'M', [
            'export function lerp(a: number, b: number, t: number): number {',
          ]),
        ],
      }),
      policy,
    );
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons.some((r) => r.startsWith('export change'))).toBe(true);
  });

  it('auto when export text changes outside src scope', () => {
    const verdict = classifyPrRisk(
      input({ files: [file('docs/recipes/x.md', 'M', ['export const a = 1'])] }),
      policy,
    );
    expect(verdict).toEqual({ risk: 'auto', reasons: [] });
  });

  it('interface member change without export stays auto (reviewer must catch)', () => {
    const verdict = classifyPrRisk(
      input({ files: [file('packages/ecs/src/query.ts', 'M', ['  readonly mask: Int32Array;'])] }),
      policy,
    );
    expect(verdict.risk).toBe('auto');
  });

  it('held for a minor changeset', () => {
    const verdict = classifyPrRisk(input({ changesetLevels: ['patch', 'minor'] }), policy);
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons).toContain('changeset level minor');
  });

  it('held for a major dependency bump', () => {
    const verdict = classifyPrRisk(
      input({
        depChanges: [
          { manifest: 'packages/cli/package.json', name: 'sharp', from: '^0.34.5', to: '^0.35.5' },
        ],
      }),
      policy,
    );
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons).toContain('major bump sharp ^0.34.5 -> ^0.35.5');
  });

  it('held stays held when the risk:held label is present', () => {
    const verdict = classifyPrRisk(input({ labels: ['risk:held'] }), policy);
    expect(verdict.risk).toBe('held');
    expect(verdict.reasons).toContain('risk:held label');
  });
});

describe('isMajorBump', () => {
  it.each([
    ['^0.34.5', '^0.35.5', true],
    ['^1.2.0', '^1.3.0', false],
    ['^1.2.0', '^2.0.0', true],
    ['~57.0.0', '~58.0.0', true],
    ['0.4.5', '0.4.6', false],
    ['workspace:*', 'workspace:*', false],
    ['github:a/b', 'github:a/c', true],
  ])('%s -> %s is %p', (from, to, expected) => {
    expect(isMajorBump(from, to)).toBe(expected);
  });
});
