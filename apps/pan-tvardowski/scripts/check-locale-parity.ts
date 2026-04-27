#!/usr/bin/env bun
/**
 * check-locale-parity — standalone audit of locale JSON tables vs the canonical
 * `LOCALIZATION_KEYS` list. Prints a concise drift report and exits non-zero if
 * any divergence is found. Used by `bun run check:locales` and CI.
 *
 * Mirrors `tests/locales-parity.test.ts` (pure assertion form). The exported
 * `auditLocaleParity` helper is the testable comparator — calling code passes
 * pre-loaded objects so the function is filesystem-free.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALIZATION_KEYS } from '../src/localization/keys';

export interface LocaleParityReport {
  readonly missingInEn: readonly string[];
  readonly missingInPl: readonly string[];
  readonly extraInEn: readonly string[];
  readonly extraInPl: readonly string[];
  readonly emptyInEn: readonly string[];
  readonly emptyInPl: readonly string[];
}

export function auditLocaleParity(
  en: Readonly<Record<string, unknown>>,
  pl: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): LocaleParityReport {
  const enKeys = new Set(Object.keys(en));
  const plKeys = new Set(Object.keys(pl));
  const expectedSet = new Set(expected);

  const missingInEn = expected.filter((k) => !enKeys.has(k)).sort();
  const missingInPl = expected.filter((k) => !plKeys.has(k)).sort();
  const extraInEn = [...enKeys].filter((k) => !expectedSet.has(k)).sort();
  const extraInPl = [...plKeys].filter((k) => !expectedSet.has(k)).sort();

  const emptyInEn: string[] = [];
  for (const [k, v] of Object.entries(en)) {
    if (typeof v !== 'string' || v.length === 0) emptyInEn.push(k);
  }
  emptyInEn.sort();

  const emptyInPl: string[] = [];
  for (const [k, v] of Object.entries(pl)) {
    if (typeof v !== 'string' || v.length === 0) emptyInPl.push(k);
  }
  emptyInPl.sort();

  return { missingInEn, missingInPl, extraInEn, extraInPl, emptyInEn, emptyInPl };
}

export function isReportClean(report: LocaleParityReport): boolean {
  return (
    report.missingInEn.length === 0 &&
    report.missingInPl.length === 0 &&
    report.extraInEn.length === 0 &&
    report.extraInPl.length === 0 &&
    report.emptyInEn.length === 0 &&
    report.emptyInPl.length === 0
  );
}

export function formatReport(report: LocaleParityReport): string {
  const lines: string[] = [];
  const section = (label: string, items: readonly string[]): void => {
    if (items.length === 0) return;
    lines.push(`  ${label} (${items.length}):`);
    for (const k of items) lines.push(`    - ${k}`);
  };
  section('missing in en.json', report.missingInEn);
  section('missing in pl.json', report.missingInPl);
  section('extra in en.json (not in LOCALIZATION_KEYS)', report.extraInEn);
  section('extra in pl.json (not in LOCALIZATION_KEYS)', report.extraInPl);
  section('empty values in en.json', report.emptyInEn);
  section('empty values in pl.json', report.emptyInPl);
  return lines.join('\n');
}

function main(): number {
  const here = dirname(fileURLToPath(import.meta.url));
  const enPath = resolve(here, '..', 'locales', 'en.json');
  const plPath = resolve(here, '..', 'locales', 'pl.json');

  const en = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, unknown>;
  const pl = JSON.parse(readFileSync(plPath, 'utf8')) as Record<string, unknown>;

  const report = auditLocaleParity(en, pl, LOCALIZATION_KEYS);

  if (isReportClean(report)) {
    console.log(
      `check-locale-parity: clean (${LOCALIZATION_KEYS.length} keys, en + pl in parity).`,
    );
    return 0;
  }

  console.error('check-locale-parity: DRIFT DETECTED');
  console.error(formatReport(report));
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
