import { describe, expect, it } from 'bun:test';
import type { GateInput, Review } from '../risk-gate.mjs';
import { decideGate, parseReviewVerdict } from '../risk-gate.mjs';

const HEAD = 'abc123';

function gate(overrides: Partial<GateInput>): GateInput {
  return {
    verdict: { risk: 'auto', reasons: [] },
    author: 'flare-bot',
    botLogin: 'flare-bot',
    ownerLogin: 'grzott',
    headSha: HEAD,
    reviews: [],
    reviewVerdict: 'pass',
    labels: [],
    requestedReviewers: [],
    ...overrides,
  };
}

const held = { risk: 'held' as const, reasons: ['held path AGENTS.md'] };

function review(state: Review['state'], commitId = HEAD, user = 'grzott'): Review {
  return { user, state, commitId };
}

describe('decideGate', () => {
  it('auto bot PR with a passing review passes and adds risk:auto', () => {
    const d = decideGate(gate({}));
    expect(d.pass).toBe(true);
    expect(d.summary).toBe('auto: classifier and review passed');
    expect(d.labelsToAdd).toEqual(['risk:auto']);
    expect(d.requestOwnerReview).toBe(false);
  });

  it('auto PR without a review verdict fails closed', () => {
    const d = decideGate(gate({ reviewVerdict: null }));
    expect(d.pass).toBe(false);
    expect(d.summary).toContain('no review verdict');
  });

  it('auto PR whose review asks for changes fails', () => {
    const d = decideGate(gate({ reviewVerdict: 'changes' }));
    expect(d.pass).toBe(false);
    expect(d.summary).toContain('review requested changes');
  });

  it('a reviewer hold makes the PR held and requests the owner', () => {
    const d = decideGate(gate({ reviewVerdict: 'held' }));
    expect(d.risk).toBe('held');
    expect(d.pass).toBe(false);
    expect(d.reasons).toContain('reviewer: breaking or owner-only change');
    expect(d.requestOwnerReview).toBe(true);
  });

  it('held PR without approval fails and requests owner review once', () => {
    expect(decideGate(gate({ verdict: held })).requestOwnerReview).toBe(true);
    const again = decideGate(gate({ verdict: held, requestedReviewers: ['grzott'] }));
    expect(again.pass).toBe(false);
    expect(again.requestOwnerReview).toBe(false);
  });

  it('owner approval of the head commit passes a held PR, even over a changes verdict', () => {
    const d = decideGate(
      gate({ verdict: held, reviewVerdict: 'changes', reviews: [review('APPROVED')] }),
    );
    expect(d.pass).toBe(true);
    expect(d.summary).toBe('approved by owner');
    expect(d.requestOwnerReview).toBe(false);
  });

  it('an approval of an older commit does not count', () => {
    expect(decideGate(gate({ verdict: held, reviews: [review('APPROVED', 'old')] })).pass).toBe(
      false,
    );
  });

  it('the latest owner review wins', () => {
    const d = decideGate(
      gate({ verdict: held, reviews: [review('APPROVED'), review('CHANGES_REQUESTED')] }),
    );
    expect(d.pass).toBe(false);
  });

  it('an approval by anyone but the owner does not count', () => {
    const d = decideGate(gate({ verdict: held, reviews: [review('APPROVED', HEAD, 'flare-bot')] }));
    expect(d.pass).toBe(false);
  });

  it('a PR not authored by the bot or dependabot is held', () => {
    const d = decideGate(gate({ author: 'someone' }));
    expect(d.pass).toBe(false);
    expect(d.reasons).toContain('not authored by the agent bot');
  });

  it('an owner-authored PR is held without a self-review request', () => {
    const d = decideGate(gate({ author: 'grzott' }));
    expect(d.pass).toBe(false);
    expect(d.requestOwnerReview).toBe(false);
  });

  it('dependabot needs no review verdict when the classifier says auto', () => {
    expect(decideGate(gate({ author: 'dependabot[bot]', reviewVerdict: null })).pass).toBe(true);
  });

  it('swaps a stale risk label and never re-adds a present one', () => {
    const swap = decideGate(gate({ verdict: held, labels: ['risk:auto'] }));
    expect(swap.labelsToAdd).toEqual(['risk:held']);
    expect(swap.labelsToRemove).toEqual(['risk:auto']);
    const steady = decideGate(gate({ labels: ['risk:auto'] }));
    expect(steady.labelsToAdd).toEqual([]);
    expect(steady.labelsToRemove).toEqual([]);
  });
});

describe('parseReviewVerdict', () => {
  const marker = (verdict: string, sha: string) =>
    `Findings...\n<!-- flare-review verdict=${verdict} sha=${sha} -->`;

  it('takes the latest github-actions marker for the head commit', () => {
    const comments = [
      { user: 'github-actions[bot]', body: marker('changes', HEAD) },
      { user: 'github-actions[bot]', body: marker('pass', HEAD) },
    ];
    expect(parseReviewVerdict(comments, HEAD)).toBe('pass');
  });

  it('ignores markers written by anyone else, including the bot', () => {
    const comments = [{ user: 'flare-bot', body: marker('pass', HEAD) }];
    expect(parseReviewVerdict(comments, HEAD)).toBeNull();
  });

  it('ignores markers for another commit', () => {
    const comments = [{ user: 'github-actions[bot]', body: marker('pass', 'other') }];
    expect(parseReviewVerdict(comments, HEAD)).toBeNull();
  });
});
