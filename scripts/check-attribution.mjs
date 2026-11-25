#!/usr/bin/env bun
/**
 * check-attribution: a PR carries no AI attribution (owner rule, 2026-11-25).
 *
 * The title, the body and every commit message of the PR are matched against
 * `.github/attribution-markers.json`: a generated-by footer, a co-author or session
 * trailer, a claude.ai session link. The same file drives `.claude/hooks/pre-bash-guard.sh`,
 * which refuses such a write before it happens. This is the half that holds when no hook
 * ran: a session elsewhere, the cloud runner, a hand edit.
 *
 * It runs in the `ci` job, a required check, so a PR that fails it cannot merge. It reads
 * the event payload GitHub writes for the run and the PR's commits from the checkout
 * (`fetch-depth: 0`); it needs no token. Outside a pull_request run it checks only itself.
 * A body edited after the run is not re-checked here; the guard covers edits made from a
 * session.
 *
 * Exit codes: 0 = clean · 1 = attribution found, or the selftest failed · 2 = setup error.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './lib/pack.mjs';

const MARKERS_FILE = join(REPO_ROOT, '.github', 'attribution-markers.json');

/** The compiled markers. Case-insensitive and per line, as in the guard. */
export function loadMarkers(source) {
  const parsed = JSON.parse(source);
  return parsed.patterns.map((p) => new RegExp(p, 'im'));
}

/** Each marker hit in `text`, as `{ line, match }` with a 1-based line number. */
export function findAttribution(text, markers) {
  const hits = [];
  const lines = (text ?? '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const re of markers) {
      const m = re.exec(lines[i]);
      if (m !== null) hits.push({ line: i + 1, match: m[0].trim() });
    }
  }
  return hits;
}

function selftest(markers) {
  const f = [];
  const must = [
    ['footer', 'Summary\n\nGenerated with [Claude Code](https://claude.com/claude-code)'],
    ['co-author trailer', 'fix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>'],
    ['session trailer', 'fix: x\n\nClaude-Session: https://claude.ai/code/session_01ABC'],
    ['session link', 'Body\n\nhttps://claude.ai/code/session_01ABC'],
    ['lowercase trailer', 'co-authored-by: claude <noreply@anthropic.com>'],
  ];
  for (const [name, text] of must) {
    if (findAttribution(text, markers).length === 0) f.push(`${name} not detected`);
  }
  const mustNot = [
    ['rule prose', 'Commits carry no co-authored-by trailer, by repo rule.'],
    ['a list item', '- Co-Authored-By trailers are refused by the guard'],
    ['a plain link', 'See https://claude.com/claude-code for the CLI.'],
    [
      'a bot co-author',
      'Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>',
    ],
    ['a person co-author', 'Co-authored-by: Jane Doe <jane@example.com>'],
  ];
  for (const [name, text] of mustNot) {
    if (findAttribution(text, markers).length !== 0) f.push(`${name} flagged by mistake`);
  }
  return f;
}

let markers;
try {
  markers = loadMarkers(readFileSync(MARKERS_FILE, 'utf8'));
} catch (err) {
  console.error(`check-attribution: cannot read ${MARKERS_FILE}: ${err.message}`);
  process.exit(2);
}

const failures = selftest(markers);
if (failures.length > 0) {
  console.error("check-attribution: SELFTEST FAILED — the gate's own logic is broken:");
  for (const x of failures) console.error(`  - ${x}`);
  process.exit(1);
}
if (process.argv.includes('--selftest')) {
  console.log('check-attribution --selftest: OK');
  process.exit(0);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
const pr = eventPath ? JSON.parse(readFileSync(eventPath, 'utf8')).pull_request : undefined;
if (pr === undefined) {
  console.log('check-attribution: not a pull_request run; selftest only. OK');
  process.exit(0);
}

const sources = [
  ['title', pr.title],
  ['body', pr.body],
];
const log = execFileSync(
  'git',
  ['log', '--format=%H%x00%B%x01', `${pr.base.sha}..${pr.head.sha}`],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);
for (const entry of log.split('\x01')) {
  const [sha, message] = entry.replace(/^\s+/, '').split('\x00');
  if (sha && message !== undefined) sources.push([`commit ${sha.slice(0, 8)}`, message]);
}

let found = 0;
for (const [where, text] of sources) {
  for (const hit of findAttribution(text, markers)) {
    console.error(`  ${where}, line ${hit.line}: ${hit.match}`);
    found++;
  }
}
if (found > 0) {
  console.error(
    `\ncheck-attribution: ${found} AI attribution line(s). This repo carries no generated-by ` +
      'footer, co-author or session trailer, or claude.ai session link. Edit the PR and push ' +
      'again (an edit alone does not re-run ci).',
  );
  process.exit(1);
}
console.log(`check-attribution: OK — title, body and ${sources.length - 2} commit(s) are clean.`);
