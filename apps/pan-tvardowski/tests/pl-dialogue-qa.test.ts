import { describe, expect, test } from 'bun:test';
import plLocale from '../locales/pl.json';

const dialogueValues = Object.entries(plLocale)
  .filter(([k]) => k.startsWith('dialogue.'))
  .map(([, v]) => v as string);

describe('PL locale QA — sanity guards', () => {
  test('no lorem ipsum placeholders in PL values', () => {
    const loremKeys = Object.entries(plLocale).filter(([, v]) =>
      (v as string).toLowerCase().includes('lorem'),
    );
    expect(loremKeys).toEqual([]);
  });

  test('no double spaces in any PL value', () => {
    const offenders = Object.entries(plLocale).filter(([, v]) => (v as string).includes('  '));
    expect(offenders).toEqual([]);
  });

  test('no leading or trailing whitespace in PL values', () => {
    const offenders = Object.entries(plLocale).filter(([, v]) => {
      const s = v as string;
      return s !== s.trim();
    });
    expect(offenders).toEqual([]);
  });

  test('dialogue keys contain at least 30 Polish diacritic characters total', () => {
    const joined = dialogueValues.join('');
    const matches = joined.match(/[łćśżźńóęąŁĆŚŻŹŃÓĘĄ]/g);
    const count = matches ? matches.length : 0;
    expect(count).toBeGreaterThanOrEqual(30);
  });

  test('specific fixes are reflected in pl.json', () => {
    const nocnyLowca = plLocale['codex.nocny-lowca.lore'];
    expect(nocnyLowca).toContain('o jeden oddech za nim');

    const czart = plLocale['codex.czart.lore'];
    expect(czart).not.toContain('sośninach');
    expect(czart.toLowerCase()).toMatch(/sosna|sosnach/);

    const madej = plLocale['codex.madej.lore'];
    expect(madej).not.toContain('bije się z niego');
  });
});
