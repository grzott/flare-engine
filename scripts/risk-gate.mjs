#!/usr/bin/env bun
/**
 * risk-gate — the one merge gate for agent PRs. It combines three inputs and
 * exits 0 (pass) or 1 (blocked); the job's own check run is what the `main`
 * ruleset requires, pinned to the GitHub Actions app so no personal token can
 * forge it:
 *
 *   1. the classify-pr-risk verdict (scripts run from the PR's BASE commit, so a
 *      PR cannot weaken the rules that judge it);
 *   2. the agent reviewer's verdict, read only from a marker comment written by
 *      `github-actions[bot]` for the current head commit (the bot account cannot
 *      write as that user; deleting the comment only fails the gate);
 *   3. the owner's approval of the current head commit.
 *
 * Auto PRs pass on a `pass` review; held PRs pass only on the owner's approval,
 * which also overrides a reviewer's `changes`. Dependabot PRs need no reviewer.
 * Labels and the owner review request are notification only — the gate never
 * reads a label, so removing one changes nothing.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { classifyPrRisk, collectInput } from './classify-pr-risk.mjs';

const DEPENDENCY_BOT = 'dependabot[bot]';
const REVIEW_AUTHOR = 'github-actions[bot]';
const MARKER = /<!-- flare-review verdict=(pass|changes|held) sha=([0-9a-f]+) -->/;

export function parseReviewVerdict(comments, headSha) {
  let verdict = null;
  for (const c of comments) {
    if (c.user !== REVIEW_AUTHOR) continue;
    const m = MARKER.exec(c.body);
    if (m && m[2] === headSha) verdict = m[1];
  }
  return verdict;
}

export function decideGate(input) {
  const reasons = [...input.verdict.reasons];
  const isDependabot = input.author === DEPENDENCY_BOT;
  if (input.author !== input.botLogin && !isDependabot)
    reasons.push('not authored by the agent bot');
  if (input.reviewVerdict === 'held') reasons.push('reviewer: breaking or owner-only change');
  const risk = reasons.length > 0 ? 'held' : 'auto';

  const ownerReviews = input.reviews.filter(
    (r) => r.user === input.ownerLogin && r.state !== 'COMMENTED' && r.state !== 'PENDING',
  );
  const latest = ownerReviews.at(-1);
  const ownerApproved = latest?.state === 'APPROVED' && latest.commitId === input.headSha;
  const reviewOk = isDependabot || input.reviewVerdict === 'pass';

  let pass = false;
  let summary;
  if (ownerApproved) {
    pass = true;
    summary = 'approved by owner';
  } else if (risk === 'held') {
    summary = `held, waiting for the owner: ${reasons.join('; ')}`;
  } else if (reviewOk) {
    pass = true;
    summary = 'auto: classifier and review passed';
  } else if (input.reviewVerdict === 'changes') {
    summary = 'review requested changes';
  } else {
    summary = 'no review verdict for this commit yet';
  }

  const wanted = `risk:${risk}`;
  const stale = risk === 'held' ? 'risk:auto' : 'risk:held';
  return {
    risk,
    reasons,
    pass,
    summary,
    labelsToAdd: input.labels.includes(wanted) ? [] : [wanted],
    labelsToRemove: input.labels.includes(stale) ? [stale] : [],
    requestOwnerReview:
      !pass &&
      risk === 'held' &&
      input.author !== input.ownerLogin &&
      !input.requestedReviewers.includes(input.ownerLogin),
  };
}

function gh(args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8' });
}

function lines(text) {
  return text.split('\n').filter(Boolean);
}

if (import.meta.main) {
  const env = process.env;
  const repo = env.GITHUB_REPOSITORY;
  const pr = env.PR;
  const headSha = env.HEAD_SHA;
  const ownerLogin = env.OWNER_LOGIN ?? 'grzott';
  if (!repo || !pr || !env.BASE_SHA || !headSha || !env.AUTHOR || !env.BOT_LOGIN) {
    console.error(
      'risk-gate: GITHUB_REPOSITORY, PR, BASE_SHA, HEAD_SHA, AUTHOR, BOT_LOGIN are required',
    );
    process.exit(2);
  }

  const labels = lines(gh([`repos/${repo}/issues/${pr}/labels`, '--jq', '.[].name']));
  const reviews = lines(
    gh([
      '--paginate',
      `repos/${repo}/pulls/${pr}/reviews`,
      '--jq',
      '.[] | [.user.login, .state, .commit_id] | @tsv',
    ]),
  ).map((row) => {
    const [user, state, commitId] = row.split('\t');
    return { user, state, commitId };
  });
  const comments = JSON.parse(gh(['--paginate', '--slurp', `repos/${repo}/issues/${pr}/comments`]))
    .flat()
    .map((c) => ({ user: c.user.login, body: c.body ?? '' }));
  const requestedReviewers = lines(
    gh([`repos/${repo}/pulls/${pr}/requested_reviewers`, '--jq', '.users[].login']),
  );

  const policy = JSON.parse(readFileSync(env.POLICY ?? '.github/risk-policy.json', 'utf8'));
  const verdict = classifyPrRisk(collectInput(env.BASE_SHA, headSha, labels, env.AUTHOR), policy);
  const decision = decideGate({
    verdict,
    author: env.AUTHOR,
    botLogin: env.BOT_LOGIN,
    ownerLogin,
    headSha,
    reviews,
    reviewVerdict: parseReviewVerdict(comments, headSha),
    labels,
    requestedReviewers,
  });

  // Notification only: a failure here must not change the gate's answer.
  try {
    for (const name of decision.labelsToRemove)
      gh(['-X', 'DELETE', `repos/${repo}/issues/${pr}/labels/${name}`]);
    for (const name of decision.labelsToAdd)
      gh(['-X', 'POST', `repos/${repo}/issues/${pr}/labels`, '-f', `labels[]=${name}`]);
    if (decision.requestOwnerReview) {
      gh([
        '-X',
        'POST',
        `repos/${repo}/pulls/${pr}/requested_reviewers`,
        '-f',
        `reviewers[]=${ownerLogin}`,
      ]);
    }
  } catch (err) {
    console.error(`risk-gate: notification step failed (${err.message}); the gate result stands`);
  }

  console.log(JSON.stringify(decision));
  console.log(`risk-gate: ${decision.pass ? 'PASS' : 'BLOCKED'} — ${decision.summary}`);
  process.exit(decision.pass ? 0 : 1);
}
