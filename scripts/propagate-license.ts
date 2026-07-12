#!/usr/bin/env bun
/**
 * Copy the root LICENSE and NOTICE into every publishable packages/*\/ so that
 * every tarball built by tsup contains the Apache-2.0 text plus the NOTICE that
 * Apache-2.0 §4(d) requires each redistribution to carry. The root files are the
 * single source of truth — package-level copies are overwritten on every run, so
 * a newly-added package (and any edit to the root files) stays consistent.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const readRoot = (file: string): Buffer => {
  const path = join(root, file);
  if (!existsSync(path)) {
    console.error(`[propagate-license] root ${file} not found`);
    process.exit(1);
  }
  return readFileSync(path);
};

const license = readRoot('LICENSE');
const notice = readRoot('NOTICE');

const packagesDir = join(root, 'packages');
if (!existsSync(packagesDir)) {
  console.error('[propagate-license] packages/ directory not found');
  process.exit(1);
}

let copied = 0;
for (const name of readdirSync(packagesDir)) {
  const dir = join(packagesDir, name);
  if (!statSync(dir).isDirectory()) continue;
  if (!existsSync(join(dir, 'package.json'))) continue;
  writeFileSync(join(dir, 'LICENSE'), license);
  writeFileSync(join(dir, 'NOTICE'), notice);
  copied++;
}

console.log(`[propagate-license] wrote LICENSE + NOTICE to ${copied} package(s)`);
