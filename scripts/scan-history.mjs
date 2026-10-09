#!/usr/bin/env bun
/**
 * F4 — full-history exposure scan, run before the repository goes public.
 *
 * The tarball audit (`audit-tarballs.mjs`) covers what ships to npm. This covers
 * what the repository's history exposes the moment its visibility flips: every
 * line ever added on any ref, scanned with the same shared pattern list
 * (`lib/leak-patterns.mjs`) plus three history-only checks — author/committer
 * emails, `.npmrc`/`.env` files ever added, and secret-shaped assignments.
 *
 * Two kinds of result, kept apart on purpose:
 *   - SECRET hits: a token-shaped value (npm/GitHub tokens, private keys, API
 *     keys, a literal `_authToken=` or CI-secret assignment). Each is listed with
 *     its commit and path, value redacted. Any of these is an owner disposition
 *     before the flip — history is not scrubbed by deleting the file.
 *   - EXPOSURE inventory: everything else the patterns match (game IP, local
 *     paths, plan references). Counted per category with the top paths, because
 *     a repository that contained the game until June matches thousands of times
 *     and that is a retention decision (F4-RATIFY), not a list of bugs.
 *
 * Uses git plumbing only — no npm, no third-party scanner.
 *
 * Usage:
 *   bun scripts/scan-history.mjs                 # full history, all refs
 *   bun scripts/scan-history.mjs --since ba173cc # only commits after a baseline
 *
 * Writes docs/plans/_local/f4-history-scan.md (gitignored).
 * Exit codes: 0 = no secret hits · 1 = secret hits (owner disposition) · 2 = setup error.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { PATTERNS } from './lib/leak-patterns.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = join(ROOT, 'docs', 'plans', '_local', 'f4-history-scan.md');

const TOKEN_CATEGORIES = new Set(['npm-token', 'gh-token', 'private-key', 'api-key']);

/** Assignments that carry a literal value rather than a `${VAR}` reference or a placeholder. */
const SECRET_ASSIGNMENTS = [
  { category: 'auth-token-literal', re: /_authToken\s*=\s*(?!\$\{)[^\s"'`]{8,}/ },
  {
    category: 'ci-secret-literal',
    re: /(?:TESTINGBOT_(?:KEY|SECRET)|EXPO_TOKEN|NPM_TOKEN)\s*[=:]\s*["']?(?!\$\{|<|your|xxx|\*)[A-Za-z0-9_-]{12,}/i,
  },
];

/**
 * The detectors themselves: their pattern lists and their selftests' planted
 * samples (synthetic alphabet runs) must contain token shapes. Hits there are
 * reported in their own section, never as secrets.
 */
const DETECTOR_SOURCE =
  /^scripts\/(?:audit-tarballs\.mjs|scan-history\.mjs|lib\/leak-patterns\.mjs|tests\/)/;

const ADDED_SENSITIVE_PATH = /(?:^|\/)\.npmrc$|(?:^|\/)\.env(?:$|\.)/;
const EXAMPLE_SUFFIX = /\.(?:example|sample|template)$/;

/** Replace a matched secret with its first four characters and a length marker. */
export const redact = (value) => `${value.slice(0, 4)}…[${value.length} chars]`;

/**
 * Classify one added line. Returns `{ secrets, exposure }`: `secrets` are
 * token-shaped matches (redacted), `exposure` the categories of every other
 * pattern that matched.
 */
export const classifyLine = (line) => {
  const secrets = [];
  const exposure = [];
  for (const p of PATTERNS) {
    const m = line.match(p.re);
    if (!m) continue;
    if (TOKEN_CATEGORIES.has(p.category)) {
      secrets.push({ category: p.category, value: redact(m[0]) });
    } else {
      exposure.push(p.category);
    }
  }
  for (const s of SECRET_ASSIGNMENTS) {
    const m = line.match(s.re);
    if (m) secrets.push({ category: s.category, value: redact(m[0]) });
  }
  return { secrets, exposure };
};

/** Is `path` one of the leak detectors, whose sources carry token shapes on purpose? */
export const isDetectorSource = (path) => DETECTOR_SOURCE.test(path);

/** Is `path` an `.npmrc` or a real (non-example) `.env` file? */
export const isSensitivePath = (path) =>
  ADDED_SENSITIVE_PATH.test(path) && !EXAMPLE_SUFFIX.test(path);

const gitText = (...args) => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
};

const scan = async (range) => {
  const secretHits = [];
  const detectorHits = [];
  const exposure = new Map();
  let commits = 0;
  let lines = 0;
  let commit = '';
  let date = '';
  let path = '';

  const args = ['log', '-p', '--no-color', '--no-ext-diff', '--format=%x00%H %ad', '--date=short'];
  if (range) args.push(range);
  else args.push('--all');
  const child = spawn('git', args, { cwd: ROOT });
  const rl = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });

  for await (const line of rl) {
    if (line.startsWith('\0')) {
      [commit, date] = line.slice(1).split(' ');
      commits++;
      continue;
    }
    if (line.startsWith('+++ ')) {
      path = line.startsWith('+++ b/') ? line.slice(6) : line.slice(4);
      continue;
    }
    if (!line.startsWith('+') || line.length < 6) continue;
    lines++;
    const { secrets, exposure: cats } = classifyLine(line.slice(1));
    const sink = isDetectorSource(path) ? detectorHits : secretHits;
    for (const s of secrets) sink.push({ ...s, commit: commit.slice(0, 10), date, path });
    for (const c of cats) {
      if (!exposure.has(c)) exposure.set(c, { count: 0, paths: new Map() });
      const e = exposure.get(c);
      e.count++;
      e.paths.set(path, (e.paths.get(path) ?? 0) + 1);
    }
  }
  const code = await new Promise((resolve) => child.on('close', resolve));
  if (code !== 0) throw new Error(`git log exited ${code}`);
  return { secretHits, detectorHits, exposure, commits, lines };
};

const renderReport = ({ range, result, emails, sensitivePaths, stamp }) => {
  const out = [];
  out.push('# F4 — full-history exposure scan', '');
  out.push(
    `_Generated ${stamp} · range: ${range ?? 'all refs, full history'} · ` +
      `${result.commits} commits · ${result.lines} added lines scanned · gitignored._`,
    '',
  );
  out.push(`## Secret-shaped hits: ${result.secretHits.length}`, '');
  if (result.secretHits.length === 0) {
    out.push('None. No token-shaped value was ever added on any scanned ref.', '');
  } else {
    out.push(
      '| Category | Commit | Date | Path | Value (redacted) |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const h of result.secretHits) {
      out.push(`| ${h.category} | ${h.commit} | ${h.date} | ${h.path} | \`${h.value}\` |`);
    }
    out.push('', 'Each needs an owner disposition in `owner-ledger.md` §3 before the flip.', '');
  }
  out.push(`## Token shapes inside the detectors themselves: ${result.detectorHits.length}`, '');
  out.push(
    'Pattern lists and selftest samples in `scripts/` — expected, not secrets. Listed so a',
    'reviewer can confirm each is synthetic (the selftest samples are alphabet runs).',
    '',
  );
  for (const h of result.detectorHits) {
    out.push(`- ${h.category} · ${h.commit} · ${h.date} · \`${h.path}\` · \`${h.value}\``);
  }
  out.push('');
  out.push(`## \`.npmrc\` / \`.env\` files ever added: ${sensitivePaths.length}`, '');
  for (const p of sensitivePaths) out.push(`- \`${p}\``);
  if (sensitivePaths.length === 0) out.push('None (`.example`/`.sample`/`.template` excluded).');
  out.push('', `## Author and committer emails: ${emails.length}`, '');
  for (const e of emails) out.push(`- ${e}`);
  out.push('', '## Exposure inventory (retention decision, not bugs)', '');
  out.push('| Category | Added lines | Top paths |', '| --- | --- | --- |');
  const cats = [...result.exposure.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [cat, e] of cats) {
    const top = [...e.paths.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p, n]) => `\`${p}\` (${n})`)
      .join(', ');
    out.push(`| ${cat} | ${e.count} | ${top} |`);
  }
  out.push('');
  return out.join('\n');
};

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const sinceIdx = argv.indexOf('--since');
  const since = sinceIdx !== -1 ? argv[sinceIdx + 1] : undefined;
  if (sinceIdx !== -1 && !since) {
    console.error('[scan-history] --since needs a revision, e.g. --since ba173cc');
    process.exit(2);
  }
  const range = since ? `${since}..HEAD` : undefined;
  try {
    const result = await scan(range);
    const emails = [
      ...new Set(gitText('log', '--all', '--format=%ae%n%ce').split('\n').filter(Boolean)),
    ].sort();
    const sensitivePaths = [
      ...new Set(
        gitText('log', '--all', '--diff-filter=A', '--name-only', '--format=')
          .split('\n')
          .filter((p) => p && isSensitivePath(p)),
      ),
    ].sort();
    const stamp = new Date().toISOString();
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, renderReport({ range, result, emails, sensitivePaths, stamp }));
    console.log(
      `[scan-history] ${result.commits} commits, ${result.lines} added lines · ` +
        `secret hits: ${result.secretHits.length} · detector self-references: ` +
        `${result.detectorHits.length} · sensitive files added: ${sensitivePaths.length} · ` +
        `emails: ${emails.length}`,
    );
    console.log(`[scan-history] report -> ${REPORT_PATH.slice(ROOT.length + 1)}`);
    process.exit(result.secretHits.length > 0 ? 1 : 0);
  } catch (err) {
    console.error(`[scan-history] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
