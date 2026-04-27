import { describe, expect, test } from 'bun:test';
import en from '../locales/en.json' with { type: 'json' };
import pl from '../locales/pl.json' with { type: 'json' };
import { auditLocaleParity, formatReport, isReportClean } from '../scripts/check-locale-parity';
import { LOCALIZATION_KEYS } from '../src/localization/keys';

describe('auditLocaleParity — M9.6 session #20', () => {
  test('reports clean for the live en + pl + LOCALIZATION_KEYS triple', () => {
    const report = auditLocaleParity(
      en as Record<string, unknown>,
      pl as Record<string, unknown>,
      LOCALIZATION_KEYS,
    );
    expect(isReportClean(report)).toBe(true);
  });

  test('flags missing keys, extra keys, and empty values', () => {
    const report = auditLocaleParity(
      { 'a.present': 'A', 'a.empty': '' },
      { 'a.present': 'A', 'pl.only': 'P' },
      ['a.present', 'a.expected', 'a.empty'],
    );
    expect(report.missingInEn).toEqual(['a.expected']);
    expect(report.missingInPl).toEqual(['a.empty', 'a.expected']);
    expect(report.extraInEn).toEqual([]);
    expect(report.extraInPl).toEqual(['pl.only']);
    expect(report.emptyInEn).toEqual(['a.empty']);
    expect(report.emptyInPl).toEqual([]);
    expect(isReportClean(report)).toBe(false);
  });

  test('formatReport renders only the non-empty sections', () => {
    const report = auditLocaleParity({ 'k.one': 'one' }, { 'k.one': 'jeden', 'k.extra': 'dwa' }, [
      'k.one',
    ]);
    const text = formatReport(report);
    expect(text).toContain('extra in pl.json');
    expect(text).toContain('k.extra');
    expect(text).not.toContain('missing in en.json');
    expect(text).not.toContain('empty values');
  });
});
