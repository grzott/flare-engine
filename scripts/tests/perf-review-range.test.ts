import { afterAll, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { reconcileReviews } from '../lib/perf-gate.mjs';
import { reviewRange } from '../lib/perf-review-range.mjs';

const root = mkdtempSync(join(tmpdir(), 'perf-review-range-'));
const hooks = join(root, 'no-hooks');
mkdirSync(hooks);
afterAll(() => rmSync(root, { recursive: true, force: true }));

const REVIEW = { date: '2026-11-01', reason: 'flush split moves drawAtlas 1000 to 8 calls' };

/**
 * The shape GitHub checks out for a pull request: a merge ref whose first
 * parent is `main` and whose second parent is the PR head.
 *
 *   A ── B (main: another PR's data-only baseline edit, no review) ── M
 *    \                                                               /
 *     P (this PR: shipped src, plus a baseline edit when asked) ────┘
 *
 * Returns the repo path and A, the stale `pull_request.base.sha`.
 */
function mergeRef(name: string, prEditsBaseline: boolean) {
  const repo = join(root, name);
  mkdirSync(repo);
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@example.test',
        '-c',
        'commit.gpgsign=false',
        '-c',
        `core.hooksPath=${hooks}`,
        ...args,
      ],
      { cwd: repo, encoding: 'utf8' },
    ).trim();
  const write = (path: string, body: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), body);
  };
  const baseline = (extra: Record<string, unknown>) =>
    `${JSON.stringify({ counters: {}, reviews: [REVIEW], ...extra }, null, 2)}\n`;

  git('init', '-q', '-b', 'main');
  write('.perf-baseline.json', baseline({}));
  write('packages/x/src/index.ts', 'export const x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'A');
  const a = git('rev-parse', 'HEAD');

  git('switch', '-q', '-c', 'pr');
  write('packages/x/src/index.ts', 'export const x = 2;\n');
  if (prEditsBaseline) write('.perf-baseline.json', baseline({ counters: { draws: 8 } }));
  git('add', '-A');
  git('commit', '-q', '-m', 'P');

  git('switch', '-q', 'main');
  write('.perf-baseline.json', baseline({ freshness: { capturedAt: 'b' } }));
  git('add', '-A');
  git('commit', '-q', '-m', 'B');

  git('merge', '-q', '--no-ff', '-m', 'M', 'pr');
  return { repo, staleBase: a };
}

function guard(requested: string | undefined, repo: string) {
  const range = reviewRange(requested, repo);
  const head = JSON.parse(readFileSync(join(repo, '.perf-baseline.json'), 'utf8'));
  return { range, problems: reconcileReviews({ ...range, newReviews: head.reviews }) };
}

describe('the rubber-stamp guard on a pull request merge ref', () => {
  const { repo, staleBase } = mergeRef('src-only', false);

  it('blames main’s baseline edit on a src-only PR when measured from the stale base.sha', () => {
    const { range, problems } = guard(staleBase, repo);
    expect(range.baselineTouched).toBe(true);
    expect(range.srcTouched).toBe(true);
    expect(problems).toEqual([
      '.perf-baseline.json changed alongside packages/*/src but added no new "reviews" entry — ' +
        'state what moved and why, dated.',
    ]);
  });

  it('sees only the PR’s own change when measured from the merge ref’s first parent', () => {
    const { range, problems } = guard('HEAD^1', repo);
    expect(range.baseRef).toBe('HEAD^1');
    expect(range.baselineTouched).toBe(false);
    expect(range.srcTouched).toBe(true);
    expect(problems).toEqual([]);
  });

  it('falls back to HEAD~1, the same first parent, when no base is given', () => {
    const { range, problems } = guard(undefined, repo);
    expect(range.baseRef).toBe('HEAD~1');
    expect(range.baselineTouched).toBe(false);
    expect(problems).toEqual([]);
  });
});

describe('the guard still bites from the first parent', () => {
  const { repo } = mergeRef('src-and-baseline', true);

  it('fails a PR that edits the baseline beside src without a new review', () => {
    const { range, problems } = guard('HEAD^1', repo);
    expect(range.baselineTouched).toBe(true);
    expect(range.srcTouched).toBe(true);
    expect(range.oldReviews).toEqual([REVIEW]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('added no new "reviews" entry');
  });
});
