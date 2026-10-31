#!/usr/bin/env bun
/**
 * check-bump-level — an above-`patch` release requires a decision, not a word.
 *
 * **The hole this closes.** `check-changeset` answers "is every changed package
 * covered by a changeset?" — coverage, never level. Nothing else in the repo
 * reads `major`/`minor`/`patch` at all. Combined with `fixed:
 * [["@flare-engine/*"]]` in `.changeset/config.json`, that
 * means **one word in one markdown frontmatter moves all 42 packages**:
 *
 *   - a stray `minor` opens the next `0.x` line across all 42 packages;
 *   - a stray `major` publishes `1.0.0` across the whole scope, and npm does not
 *     take publishes back.
 *
 * Both pass lint, typecheck, test, build, deps, changeset, peers and CI without
 * a murmur. This gate is the missing stop.
 *
 * **Why an ADR and not an env var.** The repo already has
 * `FLARE_PERF_ALLOW_STALE`, and it works because a stale benchmark is recoverable
 * — you re-capture. A published major is not recoverable. An env var protects
 * against accident; it does not protect against an agent deciding on its own
 * authority, because an agent can type it. Requiring an *accepted ADR* means the
 * only way through is a document the owner signed, and it leaves the reasoning
 * behind the bump durable instead of in a shell history.
 *
 * **What it does NOT claim.** Level is a proxy, not the safety property.
 * A `patch` can still break a consumer — a behaviour change in a hot path (say,
 * flipping a boundary comparison from `<=` to `<`) ships as `patch` and this
 * gate stays silent. It catches the loud cases. The ADR convention in
 * `docs/design/adr-0000-template.md` names the broader trigger.
 *
 * Exit codes: 0 = allowed · 1 = refused · 2 = setup error.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './lib/pack.mjs';

const CHANGESET_DIR = join(REPO_ROOT, '.changeset');
const DESIGN_DIR = join(REPO_ROOT, 'docs', 'design');

const RANK = { patch: 0, minor: 1, major: 2 };

/** Levels named in a changeset's frontmatter block. Body text is never scanned. */
export function parseLevels(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (m === null) return [];
  return [...m[1].matchAll(/:\s*(major|minor|patch)\s*$/gm)].map((x) => x[1]);
}

/** ADR ids cited anywhere in a changeset, e.g. `ADR-0002`. Case-insensitive. */
export function parseAdrRefs(source) {
  return [...source.matchAll(/ADR-(\d{4})/gi)].map((m) => m[1]);
}

/** An ADR counts only when it exists AND records an accepted decision. */
export function isAccepted(adrSource) {
  return /^\s*(?:[-*]\s*)?(?:\*\*)?Status(?:\*\*)?\s*:\s*(?:\*\*)?Accepted\b/im.test(adrSource);
}

/** Highest level in a set, or null when nothing is pending. */
export function maxLevel(levels) {
  let best = null;
  for (const l of levels) if (best === null || RANK[l] > RANK[best]) best = l;
  return best;
}

/**
 * The gate's own logic, proven on synthetic inputs before it judges the repo.
 * HYG9's lesson: a check nobody proves still fires is a check that can rot into
 * always-passing, and this one is load-bearing for an irreversible action.
 */
function selftest() {
  const f = [];
  const fm = (lvl) => `---\n'@flare-engine/math': ${lvl}\n---\n\nbody\n`;

  if (maxLevel(parseLevels(fm('patch'))) !== 'patch') f.push('patch frontmatter not parsed');
  if (maxLevel(parseLevels(fm('minor'))) !== 'minor') f.push('minor frontmatter not parsed');
  if (maxLevel(parseLevels(fm('major'))) !== 'major') f.push('major frontmatter not parsed');
  if (maxLevel(parseLevels('no frontmatter here')) !== null)
    f.push('bodyless input should yield null');

  // Precedence: the highest level in a mixed set decides.
  if (maxLevel(['patch', 'major', 'minor']) !== 'major') f.push('maxLevel precedence wrong');

  // The word must come from the frontmatter, not from prose. A changeset whose
  // body says "this is not a major change" must not read as major.
  const prose = "---\n'@flare-engine/math': patch\n---\n\nthis is not a major change\n";
  if (maxLevel(parseLevels(prose)) !== 'patch') f.push('body prose leaked into level detection');

  if (parseAdrRefs('see ADR-0007 for why').join() !== '0007') f.push('ADR ref not parsed');
  if (parseAdrRefs('adr-0012 lowercase').join() !== '0012') f.push('ADR ref case-sensitive');
  if (parseAdrRefs('no reference').length !== 0) f.push('ADR ref false positive');

  if (!isAccepted('# t\n\nStatus: Accepted\n')) f.push('plain accepted status not read');
  if (!isAccepted('- **Status**: Accepted')) f.push('bold/list accepted status not read');
  if (isAccepted('Status: Proposed')) f.push('proposed must not count as accepted');
  if (isAccepted('Status: Superseded')) f.push('superseded must not count as accepted');
  return f;
}

const failures = selftest();
if (failures.length > 0) {
  console.error("\ncheck-bump-level: SELFTEST FAILED — the gate's own logic is broken:");
  for (const x of failures) console.error(`  - ${x}`);
  console.error('\nRefusing to report a result from an unproven gate.\n');
  process.exit(1);
}
if (process.argv.includes('--selftest')) {
  console.log('check-bump-level --selftest: OK — parser, precedence and status rules all hold.');
  process.exit(0);
}

let entries;
try {
  entries = readdirSync(CHANGESET_DIR).filter((n) => n.endsWith('.md') && n !== 'README.md');
} catch (err) {
  console.error(`\ncheck-bump-level: cannot read .changeset — ${err.message}\n`);
  process.exit(2);
}

const pending = entries.map((name) => {
  const source = readFileSync(join(CHANGESET_DIR, name), 'utf8');
  return { name, level: maxLevel(parseLevels(source)), adrs: parseAdrRefs(source) };
});

const highest = maxLevel(pending.map((p) => p.level).filter((l) => l !== null));

if (highest === null || highest === 'patch') {
  console.log(
    `check-bump-level: OK — ${pending.length} pending changeset(s), highest level ` +
      `${highest ?? 'none'}. No owner decision required.`,
  );
  process.exit(0);
}

// Above patch. Find the changesets responsible and the ADR each one cites.
const raised = pending.filter((p) => p.level !== null && RANK[p.level] > RANK.patch);

let adrFiles;
try {
  adrFiles = readdirSync(DESIGN_DIR).filter((n) => /^adr-\d{4}/.test(n));
} catch {
  adrFiles = [];
}

const problems = [];
for (const p of raised) {
  if (p.adrs.length === 0) {
    problems.push(`${p.name} is "${p.level}" and cites no ADR.`);
    continue;
  }
  for (const id of p.adrs) {
    const file = adrFiles.find((n) => n.startsWith(`adr-${id}`));
    if (file === undefined) {
      problems.push(`${p.name} cites ADR-${id}, which does not exist in docs/design/.`);
      continue;
    }
    if (!isAccepted(readFileSync(join(DESIGN_DIR, file), 'utf8'))) {
      problems.push(`${p.name} cites ADR-${id} (${file}), whose Status is not "Accepted".`);
    }
  }
}

if (problems.length === 0) {
  console.log(
    `check-bump-level: OK — "${highest}" bump authorised by an accepted ADR ` +
      `(${raised.map((r) => `${r.name} -> ADR-${r.adrs.join('/')}`).join(', ')}).`,
  );
  process.exit(0);
}

const consequence =
  highest === 'major'
    ? 'publishes 1.0.0 across every @flare-engine/* package. npm does not take a publish back.'
    : 'opens the next 0.x minor across every @flare-engine/* package — a planned release, cut under an accepted ADR.';

console.error(
  `\ncheck-bump-level: REFUSED — a "${highest}" bump needs your decision, not a changeset.\n`,
);
console.error(
  `  Versioning is lockstep (.changeset/config.json "fixed"), so this cut ${consequence}\n`,
);
for (const p of problems) console.error(`  - ${p}`);
console.error('\nTo proceed, the decision has to exist as a document:');
console.error('  1. Copy docs/design/adr-0000-template.md to docs/design/adr-<NNNN>-<slug>.md');
console.error('  2. Record the consumer impact and the migration path; set Status: Accepted');
console.error(
  '  3. Cite it by id ("ADR-<NNNN>") in the body of the changeset that raises the level\n',
);
console.error('There is deliberately no env-var override: a stale benchmark is recoverable,');
console.error('a published major is not.\n');
process.exit(1);
