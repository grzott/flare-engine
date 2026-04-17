#!/usr/bin/env bun
/**
 * Copy the root LICENSE into every publishable packages/*\/ so that every
 * tarball built by tsup contains the MIT text. The root is the single source
 * of truth — package-level LICENSE files are overwritten on every run.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const licensePath = join(root, 'LICENSE');
if (!existsSync(licensePath)) {
  console.error('[propagate-license] root LICENSE not found');
  process.exit(1);
}
const license = readFileSync(licensePath);

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
  copied++;
}

console.log(`[propagate-license] wrote LICENSE to ${copied} package(s)`);
