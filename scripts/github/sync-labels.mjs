#!/usr/bin/env bun
/**
 * sync-labels — makes a repository's labels match `.github/labels.json`.
 * Creates missing labels and updates drifted ones; never deletes a label it
 * does not know, so labels added by hand or by GitHub survive.
 *
 * CLI: bun scripts/github/sync-labels.mjs <owner/repo> [labels.json]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function planLabelChanges(existing, desired) {
  const byName = new Map(existing.map((l) => [l.name, l]));
  const create = [];
  const update = [];
  for (const want of desired) {
    const have = byName.get(want.name);
    if (!have) create.push(want);
    else if (
      have.color.toLowerCase() !== want.color.toLowerCase() ||
      have.description !== want.description
    ) {
      update.push(want);
    }
  }
  return { create, update };
}

function gh(args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8' });
}

if (import.meta.main) {
  const [repo, file = '.github/labels.json'] = process.argv.slice(2);
  if (!repo) {
    console.error('usage: sync-labels <owner/repo> [labels.json]');
    process.exit(2);
  }
  const desired = JSON.parse(readFileSync(file, 'utf8'));
  const existing = gh([
    '--paginate',
    `repos/${repo}/labels`,
    '--jq',
    '.[] | [.name, .color, (.description // "")] | @tsv',
  ])
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const [name, color, description] = row.split('\t');
      return { name, color, description };
    });
  const { create, update } = planLabelChanges(existing, desired);
  for (const l of create) {
    gh([
      '-X',
      'POST',
      `repos/${repo}/labels`,
      '-f',
      `name=${l.name}`,
      '-f',
      `color=${l.color}`,
      '-f',
      `description=${l.description}`,
    ]);
  }
  for (const l of update) {
    gh([
      '-X',
      'PATCH',
      `repos/${repo}/labels/${encodeURIComponent(l.name)}`,
      '-f',
      `color=${l.color}`,
      '-f',
      `description=${l.description}`,
    ]);
  }
  console.log(`sync-labels: ${create.length} created, ${update.length} updated`);
}
