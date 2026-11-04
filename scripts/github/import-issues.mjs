#!/usr/bin/env bun
/**
 * import-issues — files a backlog manifest as GitHub milestones and issues.
 * Each issue body ends with a `backlog-id` marker, so a re-run (for example
 * after an interrupted import) creates only what is missing. Dry run by
 * default; nothing is written without --apply.
 *
 * CLI: bun scripts/github/import-issues.mjs <owner/repo> <manifest.json> [--apply]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ONE_EACH = ['type:', 'scope:', 'size:', 'priority:'];
const PRIVATE = [/_local\b/i, /roadmap[-_ ]?design/i, /\bhorizon[- ]?[A-D]\b/i];
const DESIGN_LINE = /^Design:\s*`?([^`\s]+)`?/m;
const OUTSIDE_REPO = /^([A-Za-z]:|[\\/])|(^|[\\/])\.\.([\\/]|$)/;
const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isPrivate(...texts) {
  return PRIVATE.some((re) => texts.some((t) => re.test(t)));
}

export function backlogMarker(id) {
  return `<!-- backlog-id: ${id} -->`;
}

export function validateManifest(m, knownLabels, pathExists) {
  const problems = [];
  const known = new Set(knownLabels);
  const milestones = new Set(m.milestones.map((ms) => ms.title));
  for (const ms of m.milestones) {
    if (ms.due_on !== null && !DUE_DATE.test(ms.due_on)) {
      problems.push(`milestone ${ms.title}: due_on ${ms.due_on} is not YYYY-MM-DD`);
    }
    if (isPrivate(ms.title, ms.description)) {
      problems.push(`milestone ${ms.title}: private material in a public milestone`);
    }
  }
  const seen = new Set();
  for (const issue of m.issues) {
    const at = `${issue.id}:`;
    if (seen.has(issue.id)) {
      problems.push(`${at} duplicate id ${issue.id}`);
      continue;
    }
    seen.add(issue.id);
    for (const label of issue.labels) {
      if (label.startsWith('status:')) {
        problems.push(`${at} status label ${label} (the owner applies it)`);
      } else if (!known.has(label)) {
        problems.push(`${at} unknown label ${label}`);
      }
    }
    for (const prefix of ONE_EACH) {
      const count = issue.labels.filter((l) => l.startsWith(prefix)).length;
      if (count !== 1) problems.push(`${at} needs exactly one ${prefix}* label, has ${count}`);
    }
    if (issue.milestone !== null && !milestones.has(issue.milestone)) {
      problems.push(`${at} milestone ${issue.milestone} is not declared`);
    }
    if (issue.labels.includes('size:l')) {
      const design = issue.body.match(DESIGN_LINE);
      if (!design) {
        problems.push(`${at} size:l needs a Design: <path> line`);
      } else if (OUTSIDE_REPO.test(design[1])) {
        problems.push(`${at} Design path ${design[1]} is not a repo-relative path`);
      } else if (!pathExists(design[1])) {
        problems.push(`${at} Design path ${design[1]} is not tracked in the repo`);
      }
    }
    if (isPrivate(issue.id, issue.title, issue.body)) {
      problems.push(`${at} private material (_local, roadmap-design, horizons) in a public issue`);
    }
  }
  return problems;
}

export function planIssueImport(m, existingIssues, existingMilestones) {
  const haveMilestone = new Set(existingMilestones);
  const createMilestones = m.milestones.filter((ms) => !haveMilestone.has(ms.title));
  const createIssues = [];
  const skipped = [];
  for (const issue of m.issues) {
    const marker = backlogMarker(issue.id);
    if (existingIssues.some((e) => e.body?.includes(marker))) skipped.push(issue.id);
    else createIssues.push(issue);
  }
  return { createMilestones, createIssues, skipped };
}

// `/start` checks a Design path on a Linux runner, so only a path committed at HEAD counts:
// an untracked file or a case-insensitive match on Windows would pass here and block there.
function trackedAtHead(root, path) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${path}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function gh(args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8' });
}

function jsonLines(out) {
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const [repo, file, ...rest] = args.filter((a) => a !== '--apply');
  if (!repo || !file || rest.length > 0 || !repo.includes('/')) {
    console.error('usage: import-issues <owner/repo> <manifest.json> [--apply]');
    process.exit(2);
  }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const knownLabels = JSON.parse(readFileSync(`${root}.github/labels.json`, 'utf8')).map(
    (l) => l.name,
  );
  const m = JSON.parse(readFileSync(file, 'utf8'));
  const problems = validateManifest(m, knownLabels, (p) => trackedAtHead(root, p));
  if (problems.length > 0) {
    for (const p of problems) console.error(`import-issues: ${p}`);
    process.exit(1);
  }

  const existingIssues = jsonLines(
    gh([
      '--paginate',
      `repos/${repo}/issues?state=all&per_page=100`,
      '--jq',
      '.[] | select(.pull_request == null) | {number, body} | @json',
    ]),
  );
  const milestoneNumber = new Map(
    jsonLines(
      gh([
        '--paginate',
        `repos/${repo}/milestones?state=all&per_page=100`,
        '--jq',
        '.[] | [.title, .number] | @json',
      ]),
    ),
  );
  const plan = planIssueImport(m, existingIssues, [...milestoneNumber.keys()]);

  for (const issue of plan.createIssues) {
    console.log([issue.id, issue.milestone ?? '-', issue.labels.join(','), issue.title].join('\t'));
  }
  console.log(`createMilestones: ${plan.createMilestones.length}`);
  console.log(`createIssues: ${plan.createIssues.length}`);
  console.log(`skipped: ${plan.skipped.length}`);
  if (!apply) process.exit(0);

  for (const ms of plan.createMilestones) {
    const due = ms.due_on === null ? [] : ['-f', `due_on=${ms.due_on}T12:00:00Z`];
    const number = gh([
      '-X',
      'POST',
      `repos/${repo}/milestones`,
      '-f',
      `title=${ms.title}`,
      '-f',
      `description=${ms.description}`,
      ...due,
      '--jq',
      '.number',
    ]).trim();
    milestoneNumber.set(ms.title, Number(number));
    console.log(`created milestone ${number} ${ms.title}`);
  }
  for (const issue of plan.createIssues) {
    const milestone =
      issue.milestone === null ? [] : ['-F', `milestone=${milestoneNumber.get(issue.milestone)}`];
    const number = gh([
      '-X',
      'POST',
      `repos/${repo}/issues`,
      '-f',
      `title=${issue.title}`,
      '-f',
      `body=${issue.body}\n\n${backlogMarker(issue.id)}`,
      ...milestone,
      ...issue.labels.flatMap((l) => ['-f', `labels[]=${l}`]),
      '--jq',
      '.number',
    ]).trim();
    console.log(`created #${number} ${issue.id}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
