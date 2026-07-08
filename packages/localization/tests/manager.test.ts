import { describe, expect, test } from 'bun:test';
import { LocalizationManager } from '../src/manager.js';

const tables = {
  en: { greet: 'Hi, {name}!', items: '{count, plural, one {# item} other {# items}}' },
  pl: {
    greet: 'Cześć, {name}!',
    items: '{count, plural, one {# przedmiot} few {# przedmioty} many {# przedmiotów}}',
  },
};

describe('LocalizationManager', () => {
  test('t() uses active locale template', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    expect(m.t('greet', { name: 'Ada' })).toBe('Hi, Ada!');
    m.setLocale('pl');
    expect(m.t('greet', { name: 'Ada' })).toBe('Cześć, Ada!');
  });

  test('missing key falls back to the fallback locale, then the key itself', () => {
    const m = new LocalizationManager({
      tables: { en: { only: 'fallback' }, pl: {} },
      initialLocale: 'pl',
      fallbackLocale: 'en',
    });
    expect(m.t('only')).toBe('fallback');
    expect(m.t('nope')).toBe('nope');
  });

  test('plural uses the active locale rules', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'pl', fallbackLocale: 'en' });
    expect(m.t('items', { count: 1 })).toBe('1 przedmiot');
    expect(m.t('items', { count: 3 })).toBe('3 przedmioty');
    expect(m.t('items', { count: 10 })).toBe('10 przedmiotów');
  });

  test('onChange fires when locale is swapped (but not if unchanged)', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    const log: string[] = [];
    m.onChange.add((l) => log.push(l));
    m.setLocale('en');
    m.setLocale('pl');
    m.setLocale('pl');
    expect(log).toEqual(['pl']);
  });

  test('setTable replaces an existing table and emits when targeting the active locale', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    let count = 0;
    m.onChange.add(() => count++);
    m.setTable('en', { greet: 'Yo, {name}.' });
    expect(m.t('greet', { name: 'Ada' })).toBe('Yo, Ada.');
    expect(count).toBe(1);
    m.setTable('pl', { greet: 'x' });
    expect(count).toBe(1); // not active locale
  });

  test('negotiateLocale picks the best match and activates it', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    expect(m.negotiateLocale(['pl-PL'])).toBe('pl');
    expect(m.locale).toBe('pl');
  });

  test('availableLocales lists every installed table', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    expect(m.availableLocales().sort()).toEqual(['en', 'pl']);
  });

  test('has() reports coverage across active + fallback', () => {
    const m = new LocalizationManager({
      tables: { en: { a: 'A' }, pl: { b: 'B' } },
      initialLocale: 'pl',
      fallbackLocale: 'en',
    });
    expect(m.has('a')).toBe(true);
    expect(m.has('b')).toBe(true);
    expect(m.has('c')).toBe(false);
  });

  test('has() returns false for prototype-inherited keys', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    expect(m.has('constructor')).toBe(false);
    expect(m.has('__proto__')).toBe(false);
    expect(m.has('toString')).toBe(false);
  });

  test('t() returns key fallback for prototype-inherited keys, not native code', () => {
    const m = new LocalizationManager({ tables, initialLocale: 'en', fallbackLocale: 'en' });
    expect(m.t('constructor')).toBe('constructor');
    expect(m.t('__proto__')).toBe('__proto__');
    expect(m.t('toString')).toBe('toString');
  });
});
